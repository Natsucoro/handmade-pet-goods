// 金額の計算。お客さんの画面での表示と、サーバーでの計算し直しの両方で使う。
import type { PrefectureCode } from "./prefectures.js";
import type { Product, ShippingTable } from "./types.js";

/** 送料表とお届け先から送料を出す。決まっていなければ null。 */
export function shippingFee(table: ShippingTable, prefecture: PrefectureCode): number | null {
  if (table.mode === "flat") return table.flatFee ?? null;
  return table.fees?.[prefecture] ?? null;
}

/** 質問ID → 選んだ選択肢ID（選択式の質問の答え） */
export type ChoiceAnswers = Record<string, string>;

export class PricingError extends Error {}

/** 基本の値段＋選んだ選択肢の追加料金（1個あたり） */
export function unitPrice(product: Product, answers: ChoiceAnswers): number {
  let price = product.basePrice;
  for (const q of product.questions) {
    if (q.kind !== "choice") continue;
    const chosenId = answers[q.id];
    if (chosenId === undefined || chosenId === "") {
      if (q.required) throw new PricingError(`「${q.label}」を選んでください`);
      continue;
    }
    const choice = q.choices?.find((c) => c.id === chosenId);
    if (!choice) throw new PricingError(`「${q.label}」の選択肢が見つかりません`);
    price += choice.extraPrice;
  }
  if (price < 0) throw new PricingError("金額がマイナスになっています");
  return price;
}

export interface Quote {
  unitPrice: number;
  quantity: number;
  subtotal: number;
  shipping: number;
  total: number;
}

/** 合計金額を出す。送料は1注文につき1回分。 */
export function quote(
  product: Product,
  table: ShippingTable,
  answers: ChoiceAnswers,
  prefecture: PrefectureCode,
  quantity = 1,
): Quote {
  if (!Number.isInteger(quantity) || quantity < 1) throw new PricingError("個数が正しくありません");
  const price = unitPrice(product, answers);
  const shipping = shippingFee(table, prefecture);
  if (shipping === null) throw new PricingError("この地域への送料が決まっていません");
  const subtotal = price * quantity;
  return { unitPrice: price, quantity, subtotal, shipping, total: subtotal + shipping };
}
