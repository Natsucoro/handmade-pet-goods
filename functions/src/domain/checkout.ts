// 注文の受け付け：入力のチェック、注文の組み立て、支払いが終わったときの在庫の処理。
// サーバー（functions）とお試し表示の両方で同じものを使う。
import { PREFECTURES, isPrefectureCode } from "./prefectures.js";
import { PricingError, quote } from "./pricing.js";
import type { Order, OrderAnswer, Product, PublicSettings, ShippingAddress, ShippingTable } from "./types.js";

export interface CheckoutInput {
  productId: string;
  /** 質問ID → 選んだ選択肢ID（選択式）または答えの文（自由入力） */
  answers: Record<string, string>;
  quantity: number;
  address: ShippingAddress;
  email: string;
  note?: string;
}

export type CheckoutErrors = Partial<
  Record<"answers" | "quantity" | "name" | "postalCode" | "prefecture" | "address1" | "phone" | "email" | "note" | "product", string>
>;

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

/** 入力をチェックして、「支払い待ち」の注文を組み立てる。金額はここで計算し直す（画面の数字は使わない） */
export function checkCheckout(
  input: CheckoutInput,
  product: Product,
  table: ShippingTable,
  settings: PublicSettings,
  now: number,
): { errors: CheckoutErrors; result?: CheckedOrder } {
  const errors: CheckoutErrors = {};
  if (!product.published) errors.product = "この商品はいま買えません";
  const max = maxQuantity(product);
  if (max === 0) errors.product = "売り切れのため、いまは買えません";
  if (!Number.isInteger(input.quantity) || input.quantity < 1) errors.quantity = "個数を選んでください";
  else if (input.quantity > 20) errors.quantity = "一度に注文できるのは20個までです";
  else if (max !== null && input.quantity > max) errors.quantity = `在庫は残り${max}個です`;

  // 質問への答え
  const answers: OrderAnswer[] = [];
  const choiceAnswers: Record<string, string> = {};
  for (const q of product.questions) {
    const raw = (input.answers?.[q.id] ?? "").trim();
    if (!raw) {
      if (q.required) errors.answers = `「${q.label}」に答えてください`;
      continue;
    }
    if (q.kind === "choice") {
      const c = q.choices?.find((x) => x.id === raw);
      if (!c) {
        errors.answers = `「${q.label}」の選択肢が正しくありません`;
        continue;
      }
      choiceAnswers[q.id] = c.id;
      answers.push({ questionId: q.id, label: q.label, answer: c.label, extraPrice: c.extraPrice });
    } else {
      if (raw.length > MAX_TEXT_ANSWER) errors.answers = `「${q.label}」は${MAX_TEXT_ANSWER}文字までです`;
      answers.push({ questionId: q.id, label: q.label, answer: raw, extraPrice: 0 });
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

  let q: ReturnType<typeof quote> | null = null;
  if (!errors.answers && !errors.quantity && !errors.prefecture) {
    try {
      q = quote(product, table, choiceAnswers, a.prefecture, input.quantity);
    } catch (e) {
      if (e instanceof PricingError) errors.prefecture = e.message;
      else throw e;
    }
  }
  if (Object.keys(errors).length > 0 || !q) return { errors };

  const address: ShippingAddress = { name, postalCode: postal!, prefecture: a.prefecture, address1 };
  if ((a.address2 ?? "").trim()) address.address2 = a.address2!.trim();
  if (phone) address.phone = phone;
  return {
    errors,
    result: {
      order: {
        createdAtMs: now,
        status: "pending_payment",
        items: [{ productId: product.id, name: product.name, unitPrice: q.unitPrice, quantity: q.quantity, answers }],
        subtotal: q.subtotal,
        shipping: q.shipping,
        total: q.total,
        address,
        email,
        ...(note ? { note } : {}),
        leadDays: product.leadDays,
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
  product: Product | null,
): { status: "paid" | "cancelled"; newStock: number | null; reason?: string } {
  const qty = order.items.reduce((n, i) => n + i.quantity, 0);
  if (!product) return { status: "cancelled", newStock: null, reason: "商品が見つかりませんでした" };
  if (product.stockType === "made_to_order") return { status: "paid", newStock: null };
  if (product.stock >= qty) return { status: "paid", newStock: product.stock - qty };
  if (product.whenSoldOut === "made_to_order") return { status: "paid", newStock: 0 };
  return { status: "cancelled", newStock: null, reason: "ほかのお客さまのご注文と重なり、在庫がなくなりました" };
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
