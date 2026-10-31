import { describe, expect, it } from "vitest";
import { checkCheckout, maxQuantity, normalizePhone, normalizePostalCode, orderNumber, settlePayment, type CheckoutInput } from "./checkout.js";
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
const settings = { shopName: "テスト", phoneRequired: false };
const input = (patch: Partial<CheckoutInput> = {}): CheckoutInput => ({
  productId: "p1",
  answers: { size: "l", name: " ぴーちゃん " },
  quantity: 1,
  address: { name: "にせ 花子", postalCode: "１２３４５６７", prefecture: "01", address1: "にせ市1-2-3" },
  email: "hanako@example.com",
  ...patch,
});

describe("注文のチェック", () => {
  it("計画書の例：3,000円＋L 500円＋北海道 1,200円＝4,700円。答えも残す", () => {
    const { errors, result } = checkCheckout(input(), product, table, settings, 1000);
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
      input({ answers: {}, address: { name: "", postalCode: "12", prefecture: "99" as never, address1: "" }, email: "x" }),
      product, table, { ...settings, phoneRequired: true }, 0,
    );
    expect(result).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(["address1", "answers", "email", "name", "phone", "postalCode", "prefecture"]);
  });
  it("在庫より多くは買えない。売り切れは買えない。受注生産は上限なし", () => {
    expect(checkCheckout(input({ quantity: 3 }), product, table, settings, 0).errors.quantity).toBe("在庫は残り2個です");
    expect(checkCheckout(input(), { ...product, stock: 0 }, table, settings, 0).errors.product).toContain("売り切れ");
    expect(maxQuantity({ ...product, stock: 0, whenSoldOut: "made_to_order" })).toBeNull();
  });
  it("送料が決まっていない地域は受け付けない", () => {
    expect(checkCheckout(input({ address: { ...input().address, prefecture: "47" } }), product, table, settings, 0).errors.prefecture).toBeTruthy();
  });
  it("郵便番号・電話番号をそろえる", () => {
    expect(normalizePostalCode("123ー4567")).toBe("123-4567");
    expect(normalizePhone("０９０－１２３４－５６７８")).toBe("090-1234-5678");
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("支払いが終わったとき", () => {
  const order = { items: [{ quantity: 2 }] } as Order;
  it("在庫を減らす", () => expect(settlePayment(order, product)).toEqual({ status: "paid", newStock: 0 }));
  it("同時に買われて在庫が足りなければキャンセル（受注生産に切り替える設定なら受ける）", () => {
    expect(settlePayment(order, { ...product, stock: 1 }).status).toBe("cancelled");
    expect(settlePayment(order, { ...product, stock: 1, whenSoldOut: "made_to_order" })).toEqual({ status: "paid", newStock: 0 });
  });
});

it("注文番号は日本の日付", () => {
  expect(orderNumber(Date.UTC(2026, 9, 30, 16, 0), 3)).toBe("20261031-003");
});

it("メール：入金済みでお客さんとお姉ちゃんに、発送でお客さんに", () => {
  const { result } = checkCheckout(input(), product, table, settings, 0);
  const o = { ...result!.order, id: "o1", number: "20261031-001", status: "paid" } as Order;
  const paid = mailsFor(o, "paid", "ことり", "https://example.com/orders/o1?t=x", 0);
  expect(paid.map((m) => m.to)).toEqual(["customer", "shop"]);
  expect(paid[0].body).toContain("合計 4,700円");
  expect(paid[0].body).toContain("https://example.com/orders/o1?t=x");
  const shipped = mailsFor({ ...o, carrier: "yamato", trackingNumber: "123" }, "shipped", "ことり", "u", 0)
  expect(shipped[0].body).toContain("ヤマト運輸")
});
