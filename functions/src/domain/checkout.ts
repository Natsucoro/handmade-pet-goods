// 注文の受け付け：入力のチェック、注文の組み立て、支払いが終わったときの在庫の処理。
// サーバー（functions）とお試し表示の両方で同じものを使う。
import { PREFECTURES, isPrefectureCode } from "./prefectures.js";
import { PricingError, shippingFee, unitPrice } from "./pricing.js";
import type { PrefectureCode } from "./prefectures.js";
import type { Order, OrderAnswer, OrderItem, Product, PublicSettings, ShippingAddress, ShippingTable } from "./types.js";

/** カートの1行（同じ商品でも、選んだ内容が違えば別の行） */
export interface CartLineInput {
  productId: string;
  /** 質問ID → 選んだ選択肢ID（選択式）または答えの文（自由入力） */
  answers: Record<string, string>;
  quantity: number;
}

export interface CheckoutInput {
  items: CartLineInput[];
  address: ShippingAddress;
  email: string;
  note?: string;
}

export type CheckoutErrors = Partial<
  Record<"items" | "name" | "postalCode" | "prefecture" | "address1" | "phone" | "email" | "note", string>
>;

/** 1つの注文に入れられる行の数・1行の個数の上限 */
export const MAX_LINES = 20;
export const MAX_QUANTITY = 20;

export const MAX_TEXT_ANSWER = 200;
export const MAX_NOTE = 1000;

/** 「1234567」「１２３-４５６７」→「123-4567」。おかしければ null */
export function normalizePostalCode(s: string): string | null {
  const d = s.normalize("NFKC").replace(/[^0-9]/g, "");
  return d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : null;
}

export function normalizePhone(s: string): string | null {
  const t = s.normalize("NFKC").replace(/[\s()（）ー−–]/g, (c) => (c === "ー" || c === "−" || c === "–" ? "-" : ""));
  return /^0\d{1,4}-?\d{1,4}-?\d{3,4}$/.test(t) && t.replace(/-/g, "").length >= 10 ? t : null;
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** 在庫から、いま何個まで買えるか（受注生産は上限なし＝null）。0 なら買えない */
export function maxQuantity(p: Pick<Product, "stockType" | "stock" | "whenSoldOut">): number | null {
  if (p.stockType === "made_to_order") return null;
  if (p.stock > 0) return p.stock;
  return p.whenSoldOut === "made_to_order" ? null : 0;
}

export interface CheckedOrder {
  order: Omit<Order, "id" | "number" | "viewToken">;
}

/** 送料：同じ送料表（配送方法）の商品は1回分、違う送料表どうしは足す（なつみの決定 2026年10月31日） */
export function cartShipping(tables: ShippingTable[], prefecture: PrefectureCode): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const t of tables) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const fee = shippingFee(t, prefecture);
    if (fee === null) throw new PricingError(`この地域への送料（${t.name}）が決まっていません`);
    sum += fee;
  }
  return sum;
}

/** 1行分の答えをチェックして、注文に残す形にする。おかしければエラーの文 */
export function checkLine(
  line: CartLineInput,
  product: Product | undefined,
): { error: string } | { item: OrderItem } {
  if (!product || !product.published) return { error: "買えない商品が入っています。カートから外してください" };
  const name = `「${product.name}」`;
  if (maxQuantity(product) === 0) return { error: `${name}は売り切れのため、いまは買えません` };
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
    return { error: `${name}の個数は1〜${MAX_QUANTITY}個にしてください` };
  }
  const answers: OrderAnswer[] = [];
  const choiceAnswers: Record<string, string> = {};
  for (const q of product.questions) {
    const raw = String(line.answers?.[q.id] ?? "").trim();
    if (!raw) {
      if (q.required) return { error: `${name}の「${q.label}」を選んでください` };
      continue;
    }
    if (q.kind === "choice") {
      const c = q.choices?.find((x) => x.id === raw);
      if (!c) return { error: `${name}の「${q.label}」の選択肢が変わりました。選び直してください` };
      choiceAnswers[q.id] = c.id;
      answers.push({ questionId: q.id, label: q.label, answer: c.label, extraPrice: c.extraPrice });
    } else {
      if (raw.length > MAX_TEXT_ANSWER) return { error: `${name}の「${q.label}」は${MAX_TEXT_ANSWER}文字までです` };
      answers.push({ questionId: q.id, label: q.label, answer: raw, extraPrice: 0 });
    }
  }
  let price: number;
  try {
    price = unitPrice(product, choiceAnswers);
  } catch (e) {
    if (e instanceof PricingError) return { error: `${name}：${e.message}` };
    throw e;
  }
  return { item: { productId: product.id, name: product.name, unitPrice: price, quantity: line.quantity, answers } };
}

/** 同じ商品の個数の合計が在庫を超えていないか */
function stockError(items: OrderItem[], products: Record<string, Product>): string | null {
  const totals = new Map<string, number>();
  for (const i of items) totals.set(i.productId, (totals.get(i.productId) ?? 0) + i.quantity);
  for (const [id, qty] of totals) {
    const max = maxQuantity(products[id]);
    if (max !== null && qty > max) return `「${products[id].name}」の在庫は残り${max}個です（カートに合わせて${qty}個あります）`;
  }
  return null;
}

/** 入力をチェックして、「支払い待ち」の注文を組み立てる。金額はここで計算し直す（画面の数字は使わない） */
export function checkCheckout(
  input: CheckoutInput,
  products: Record<string, Product>,
  tables: Record<string, ShippingTable>,
  settings: PublicSettings,
  now: number,
): { errors: CheckoutErrors; result?: CheckedOrder } {
  const errors: CheckoutErrors = {};
  const lines = Array.isArray(input.items) ? input.items : [];
  const items: OrderItem[] = [];
  if (lines.length === 0) errors.items = "カートが空です";
  else if (lines.length > MAX_LINES) errors.items = `1回のご注文は${MAX_LINES}種類までです`;
  else {
    for (const line of lines) {
      const r = checkLine(line, products[line?.productId]);
      if ("error" in r) {
        errors.items = r.error;
        break;
      }
      items.push(r.item);
    }
    if (!errors.items) {
      const se = stockError(items, products);
      if (se) errors.items = se;
    }
  }

  // お届け先
  const a = input.address ?? ({} as ShippingAddress);
  const name = (a.name ?? "").trim();
  if (!name) errors.name = "お名前を入れてください";
  const postal = normalizePostalCode(a.postalCode ?? "");
  if (!postal) errors.postalCode = "郵便番号を7けたの数字で入れてください";
  if (!isPrefectureCode(a.prefecture)) errors.prefecture = "都道府県を選んでください";
  const address1 = (a.address1 ?? "").trim();
  if (!address1) errors.address1 = "市区町村・番地を入れてください";
  const phoneRaw = (a.phone ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) errors.phone = "電話番号を数字で入れてください（例：090-1234-5678）";
  if (!phoneRaw && settings.phoneRequired) errors.phone = "電話番号を入れてください";
  const email = (input.email ?? "").trim();
  if (!isEmail(email)) errors.email = "メールアドレスを正しく入れてください";
  const note = (input.note ?? "").trim();
  if (note.length > MAX_NOTE) errors.note = `${MAX_NOTE}文字までです`;

  let shipping: number | null = null;
  if (!errors.items && !errors.prefecture) {
    const used = items.map((i) => tables[products[i.productId].shippingTableId]);
    if (used.some((t) => !t)) errors.items = "送料表が見つからない商品があります";
    else {
      try {
        shipping = cartShipping(used, a.prefecture);
      } catch (e) {
        if (e instanceof PricingError) errors.prefecture = e.message;
        else throw e;
      }
    }
  }
  if (Object.keys(errors).length > 0 || shipping === null) return { errors };

  const address: ShippingAddress = { name, postalCode: postal!, prefecture: a.prefecture, address1 };
  if ((a.address2 ?? "").trim()) address.address2 = a.address2!.trim();
  if (phone) address.phone = phone;
  const subtotal = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
  return {
    errors,
    result: {
      order: {
        createdAtMs: now,
        status: "pending_payment",
        items,
        subtotal,
        shipping,
        total: subtotal + shipping,
        address,
        email,
        ...(note ? { note } : {}),
        // いちばん時間のかかる商品に合わせて、まとめて送る
        leadDays: Math.max(...items.map((i) => products[i.productId].leadDays)),
        mails: [],
      },
    },
  };
}

/**
 * 支払いが終わったときの処理。在庫を減らして「入金済み」にする。
 * 最後の1個を同時に買われて在庫が足りないときは、受注生産に切り替える設定ならそのまま受け、
 * そうでなければキャンセル（返金）にする。
 */
export function settlePayment(
  order: Order,
  products: Record<string, Product | null>,
): { status: "paid" | "cancelled"; newStock: Record<string, number>; reason?: string } {
  const totals = new Map<string, number>();
  for (const i of order.items) totals.set(i.productId, (totals.get(i.productId) ?? 0) + i.quantity);
  const newStock: Record<string, number> = {};
  for (const [id, qty] of totals) {
    const p = products[id];
    if (!p) return { status: "cancelled", newStock: {}, reason: "商品が見つかりませんでした" };
    if (p.stockType === "made_to_order") continue;
    if (p.stock >= qty) newStock[id] = p.stock - qty;
    else if (p.whenSoldOut === "made_to_order") newStock[id] = 0;
    // 1つでも足りなければ、注文ごとキャンセル（返金）にする
    else return { status: "cancelled", newStock: {}, reason: "ほかのお客さまのご注文と重なり、在庫がなくなりました" };
  }
  return { status: "paid", newStock };
}

/** 注文番号：日本の日付＋その日の何件目（例：20261031-003） */
export function orderNumber(nowMs: number, seq: number): string {
  const d = new Date(nowMs + 9 * 3600_000);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `${ymd}-${String(seq).padStart(3, "0")}`;
}

export function prefectureName(code: string): string {
  return PREFECTURES.find((p) => p.code === code)?.name ?? "";
}
