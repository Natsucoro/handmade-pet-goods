import { describe, expect, it } from "vitest";
import { cartShipping, checkCheckout, maxQuantity, normalizePhone, normalizePostalCode, orderNumber, settlePayment, type CheckoutInput } from "./checkout.js";
import { mailsFor } from "./mails.js";
import type { Order, Product, ShippingTable } from "./types.js";

const product: Product = {
  id: "p1", name: "文鳥のつぼ巣", basePrice: 3000, shippingTableId: "t1", description: [], photos: [], published: true,
  stockType: "stock", stock: 2, whenSoldOut: "sold_out", leadDays: 4, createdAtMs: 0, categoryIds: [], sortOrder: 0,
  questions: [
    { id: "size", label: "サイズ", kind: "choice", required: true, choices: [{ id: "m", label: "M", extraPrice: 0 }, { id: "l", label: "L", extraPrice: 500 }] },
    { id: "name", label: "お名前", kind: "text", required: false },
  ],
};
const table: ShippingTable = { id: "t1", name: "箱", mode: "by_prefecture", fees: { "01": 1200, "13": 870 } };
const post: ShippingTable = { id: "t2", name: "クリックポスト", mode: "flat", flatFee: 185 };
const pouch: Product = { ...product, id: "p2", name: "ポーチ", basePrice: 1000, shippingTableId: "t2", stockType: "made_to_order", stock: 0, leadDays: 10, questions: [] };
const card: Product = { ...pouch, id: "p3", name: "カード", basePrice: 300, leadDays: 2 };
const products = { p1: product, p2: pouch, p3: card };
const tables = { t1: table, t2: post };
const settings = { shopName: "テスト", phoneRequired: false };
const input = (patch: Partial<CheckoutInput> = {}): CheckoutInput => ({
  items: [{ productId: "p1", answers: { size: "l", name: " ぴーちゃん " }, quantity: 1 }],
  address: { name: "にせ 花子", postalCode: "１２３４５６７", prefecture: "01", address1: "にせ市1-2-3" },
  email: "hanako@example.com",
  ...patch,
});

describe("注文のチェック", () => {
  it("計画書の例：3,000円＋L 500円＋北海道 1,200円＝4,700円。答えも残す", () => {
    const { errors, result } = checkCheckout(input(), products, tables, settings, 1000);
    expect(errors).toEqual({});
    const o = result!.order;
    expect(o.total).toBe(4700);
    expect(o.status).toBe("pending_payment");
    expect(o.address.postalCode).toBe("123-4567");
    expect(o.items[0].answers).toEqual([
      { questionId: "size", label: "サイズ", answer: "L", extraPrice: 500 },
      { questionId: "name", label: "お名前", answer: "ぴーちゃん", extraPrice: 0 },
    ]);
  });
  it("入れ忘れ・おかしな入力を教える", () => {
    const { errors, result } = checkCheckout(
      input({ items: [{ productId: "p1", answers: {}, quantity: 1 }], address: { name: "", postalCode: "12", prefecture: "99" as never, address1: "" }, email: "x" }),
      products, tables, { ...settings, phoneRequired: true }, 0,
    );
    expect(result).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(["address1", "email", "items", "name", "phone", "postalCode", "prefecture"]);
    expect(errors.items).toBe("「文鳥のつぼ巣」の「サイズ」を選んでください");
    expect(checkCheckout(input({ items: [] }), products, tables, settings, 0).errors.items).toBe("カートが空です");
  });
  it("在庫より多くは買えない。売り切れは買えない。受注生産は上限なし", () => {
    const line = { productId: "p1", answers: { size: "m" }, quantity: 2 };
    // 選んだ内容が違う2行でも、同じ商品なら個数を合わせて在庫と比べる
    expect(checkCheckout(input({ items: [line, { ...line, answers: { size: "l" }, quantity: 1 }] }), products, tables, settings, 0).errors.items).toBe(
      "「文鳥のつぼ巣」の在庫は残り2個です（カートに合わせて3個あります）",
    );
    expect(checkCheckout(input(), { ...products, p1: { ...product, stock: 0 } }, tables, settings, 0).errors.items).toContain("売り切れ");
    expect(maxQuantity({ ...product, stock: 0, whenSoldOut: "made_to_order" })).toBeNull();
  });
  it("送料が決まっていない地域は受け付けない", () => {
    expect(checkCheckout(input({ address: { ...input().address, prefecture: "47" } }), products, tables, settings, 0).errors.prefecture).toBeTruthy();
  });
  it("まとめ買い：同じ配送方法は送料1回分、違う配送方法は足す。お届けの目安は一番長いもの", () => {
    const items = [
      { productId: "p1", answers: { size: "m" }, quantity: 1 },
      { productId: "p2", answers: {}, quantity: 2 },
      { productId: "p3", answers: {}, quantity: 1 },
    ];
    const o = checkCheckout(input({ items, address: { ...input().address, prefecture: "13" } }), products, tables, settings, 0).result!.order;
    expect(o.subtotal).toBe(3000 + 2000 + 300);
    expect(o.shipping).toBe(870 + 185); // つぼ巣の箱 ＋ クリックポスト1回分（ポーチとカードで1回）
    expect(o.total).toBe(6355);
    expect(o.leadDays).toBe(10);
    expect(o.items.map((i) => i.name)).toEqual(["文鳥のつぼ巣", "ポーチ", "カード"]);
    expect(cartShipping([post, post, post], "13")).toBe(185);
  });
  it("郵便番号・電話番号をそろえる", () => {
    expect(normalizePostalCode("123ー4567")).toBe("123-4567");
    expect(normalizePhone("０９０－１２３４－５６７８")).toBe("090-1234-5678");
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("支払いが終わったとき", () => {
  const order = { items: [{ productId: "p1", quantity: 1 }, { productId: "p1", quantity: 1 }, { productId: "p2", quantity: 5 }] } as Order;
  it("在庫を減らす（受注生産は減らさない）", () => expect(settlePayment(order, products)).toEqual({ status: "paid", newStock: { p1: 0 } }));
  it("同時に買われて在庫が足りなければ注文ごとキャンセル（受注生産に切り替える設定なら受ける）", () => {
    expect(settlePayment(order, { ...products, p1: { ...product, stock: 1 } }).status).toBe("cancelled");
    expect(settlePayment(order, { ...products, p1: { ...product, stock: 1, whenSoldOut: "made_to_order" } })).toEqual({ status: "paid", newStock: { p1: 0 } });
  });
});

it("注文番号は日本の日付", () => {
  expect(orderNumber(Date.UTC(2026, 9, 30, 16, 0), 3)).toBe("20261031-003");
});

it("メール：入金済みでお客さんとお姉ちゃんに、発送でお客さんに", () => {
  const { result } = checkCheckout(input(), products, tables, settings, 0);
  const o = { ...result!.order, id: "o1", number: "20261031-001", status: "paid" } as Order;
  const paid = mailsFor(o, "paid", "ことり", "https://example.com/orders/o1?t=x", 0);
  expect(paid.map((m) => m.to)).toEqual(["customer", "shop"]);
  expect(paid[0].body).toContain("合計 4,700円");
  expect(paid[0].body).toContain("https://example.com/orders/o1?t=x");
  const shipped = mailsFor({ ...o, carrier: "yamato", trackingNumber: "123" }, "shipped", "ことり", "u", 0)
  expect(shipped[0].body).toContain("ヤマト運輸")
});
