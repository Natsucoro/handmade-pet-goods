// サーバー側のプログラム（Cloud Functions）。
// 本物に上げるには Blaze（従量制）が必要なので、ステップ1では練習用（エミュレーター）でだけ動かす。
import "./setup.js";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { isPrefectureCode } from "./domain/prefectures.js";
import { PricingError, quote } from "./domain/pricing.js";
import type { Product, ShippingTable } from "./domain/types.js";

/** 商品・選択肢・お届け先から合計金額を計算し直す（画面の数字は信じない）。 */
export const quoteOrder = onCall(async (request) => {
  const { productId, answers, prefecture, quantity } = (request.data ?? {}) as Record<string, unknown>;
  if (typeof productId !== "string" || !isPrefectureCode(prefecture)) {
    throw new HttpsError("invalid-argument", "入力が正しくありません");
  }
  const db = getFirestore();
  const productSnap = await db.collection("products").doc(productId).get();
  const product = productSnap.data() as Omit<Product, "id"> | undefined;
  if (!product || !product.published) throw new HttpsError("not-found", "商品が見つかりません");
  const tableSnap = await db.collection("shippingTables").doc(product.shippingTableId).get();
  const table = tableSnap.data() as Omit<ShippingTable, "id"> | undefined;
  if (!table) throw new HttpsError("failed-precondition", "送料表が見つかりません");
  try {
    return quote(
      { ...product, id: productSnap.id },
      { ...table, id: tableSnap.id },
      (answers ?? {}) as Record<string, string>,
      prefecture,
      typeof quantity === "number" ? quantity : 1,
    );
  } catch (e) {
    if (e instanceof PricingError) throw new HttpsError("invalid-argument", e.message);
    throw e;
  }
});

export { confirmReceived, createOrder, getOrderStatus, testPay } from "./orders.js";
