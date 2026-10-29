import { describe, expect, it } from "vitest";
import { PricingError, quote, shippingFee, unitPrice } from "./pricing.js";
import type { Product, ShippingTable } from "./types.js";

const product: Product = {
  id: "p1",
  name: "文鳥のつぼ巣",
  basePrice: 3000,
  shippingTableId: "t1",
  description: [],
  photos: [],
  published: true,
  stockType: "stock",
  stock: 3,
  whenSoldOut: "sold_out",
  leadDays: 3,
  createdAtMs: 0,
  categoryIds: [],
  sortOrder: 0,
  questions: [
    {
      id: "size",
      label: "サイズ",
      kind: "choice",
      required: true,
      choices: [
        { id: "m", label: "M", extraPrice: 0 },
        { id: "l", label: "L", extraPrice: 500 },
      ],
    },
    {
      id: "name",
      label: "名入れ",
      kind: "choice",
      required: false,
      choices: [{ id: "yes", label: "あり", extraPrice: 300 }],
    },
    { id: "memo", label: "ご要望", kind: "text", required: false },
  ],
};

const byPref: ShippingTable = {
  id: "t1",
  name: "ゆうパック60サイズ",
  mode: "by_prefecture",
  fees: { "01": 1200, "13": 870 },
};

describe("送料", () => {
  it("全国一律", () => {
    expect(shippingFee({ id: "f", name: "x", mode: "flat", flatFee: 430 }, "47")).toBe(430);
  });
  it("都道府県ごと", () => {
    expect(shippingFee(byPref, "01")).toBe(1200);
    expect(shippingFee(byPref, "47")).toBeNull();
  });
});

describe("金額", () => {
  it("計画書の例：3,000円＋Lサイズ500円＋北海道の送料1,200円＝4,700円", () => {
    expect(quote(product, byPref, { size: "l" }, "01")).toEqual({
      unitPrice: 3500,
      quantity: 1,
      subtotal: 3500,
      shipping: 1200,
      total: 4700,
    });
  });
  it("任意の選択肢の追加料金も足す", () => {
    expect(unitPrice(product, { size: "m", name: "yes" })).toBe(3300);
  });
  it("必須の質問が空なら計算しない", () => {
    expect(() => unitPrice(product, {})).toThrow(PricingError);
  });
  it("ない選択肢を送られたら計算しない", () => {
    expect(() => unitPrice(product, { size: "xl" })).toThrow(PricingError);
  });
  it("送料が決まっていない地域は計算しない", () => {
    expect(() => quote(product, byPref, { size: "m" }, "47")).toThrow(PricingError);
  });
  it("個数が0やマイナスなら計算しない", () => {
    expect(() => quote(product, byPref, { size: "m" }, "13", 0)).toThrow(PricingError);
  });
});
