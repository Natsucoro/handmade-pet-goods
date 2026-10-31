// 注文の受け付け（サーバー側）。
// - createOrder：入力をチェックし、金額を計算し直して「支払い待ち」の注文を作る
// - testPay：練習用（エミュレーター）だけ。「お支払いが終わったふり」をする（本物は Stripe の通知で同じ処理をする）
// - getOrderStatus / confirmReceived：お客さんが注文の状況を見る・「受け取りました」を押す（注文番号の合言葉で）
import "./setup.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { checkCheckout, orderNumber, settlePayment, type CheckoutInput } from "./domain/checkout.js";
import { mailsFor, type MailEvent } from "./domain/mails.js";
import { DEFAULT_PUBLIC_SETTINGS, type Order, type Product, type PublicSettings, type ShippingTable } from "./domain/types.js";

const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

function siteOrigin(req: CallableRequest): string {
  const origin = req.rawRequest?.headers?.origin;
  if (typeof origin === "string" && /^(https:\/\/handmade-pet-goods-shop\.(web\.app|firebaseapp\.com)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin)) return origin;
  return process.env.SITE_ORIGIN ?? "";
}

async function publicSettings(): Promise<PublicSettings> {
  const snap = await getFirestore().doc("settings/public").get();
  return { ...DEFAULT_PUBLIC_SETTINGS, ...(snap.data() as Partial<PublicSettings> | undefined) };
}

function sameToken(a: unknown, b: string | undefined): boolean {
  if (typeof a !== "string" || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function loadOrderWithToken(orderId: unknown, token: unknown): Promise<Order> {
  if (typeof orderId !== "string" || !orderId) throw new HttpsError("invalid-argument", "注文が見つかりません");
  const snap = await getFirestore().collection("orders").doc(orderId).get();
  const order = snap.exists ? ({ ...(snap.data() as Omit<Order, "id">), id: snap.id } as Order) : null;
  // 合言葉が違うときも「見つからない」と答える（他人の注文があるかどうかもわからないように）
  if (!order || !sameToken(token, order.viewToken)) throw new HttpsError("not-found", "注文が見つかりません");
  return order;
}

const statusUrl = (origin: string, o: Pick<Order, "id" | "viewToken">) => `${origin}/orders/${o.id}?t=${o.viewToken}`;

export const createOrder = onCall(async (req) => {
  const input = (req.data ?? {}) as CheckoutInput;
  if (typeof input.productId !== "string") throw new HttpsError("invalid-argument", "商品が見つかりません");
  const db = getFirestore();
  const pSnap = await db.collection("products").doc(input.productId).get();
  if (!pSnap.exists) throw new HttpsError("not-found", "商品が見つかりません");
  const product = { ...(pSnap.data() as Omit<Product, "id">), id: pSnap.id, categoryIds: [], sortOrder: 0 } as Product;
  const tSnap = await db.collection("shippingTables").doc(product.shippingTableId).get();
  if (!tSnap.exists) throw new HttpsError("failed-precondition", "送料表が見つかりません");
  const table = { ...(tSnap.data() as Omit<ShippingTable, "id">), id: tSnap.id };
  const now = Date.now();
  const { errors, result } = checkCheckout(input, product, table, await publicSettings(), now);
  if (!result) throw new HttpsError("invalid-argument", "入力を確かめてください", { errors });

  const viewToken = randomBytes(18).toString("base64url");
  const ref = db.collection("orders").doc();
  const number = await db.runTransaction(async (tx: Transaction) => {
    const day = orderNumber(now, 0).slice(0, 8);
    const counterRef = db.collection("counters").doc(`orders-${day}`);
    const c = await tx.get(counterRef);
    const seq = ((c.data()?.n as number | undefined) ?? 0) + 1;
    tx.set(counterRef, { n: seq });
    const num = orderNumber(now, seq);
    tx.set(ref, { ...result.order, number: num, viewToken });
    return num;
  });
  return { orderId: ref.id, number, token: viewToken };
});

/** 支払いが終わったときの処理（本物は Stripe の通知から呼ぶ） */
export async function markPaid(orderId: string, origin: string): Promise<Order["status"]> {
  const db = getFirestore();
  const shop = await publicSettings();
  return db.runTransaction(async (tx: Transaction) => {
    const oRef = db.collection("orders").doc(orderId);
    const oSnap = await tx.get(oRef);
    if (!oSnap.exists) throw new HttpsError("not-found", "注文が見つかりません");
    const order = { ...(oSnap.data() as Omit<Order, "id">), id: oSnap.id } as Order;
    if (order.status !== "pending_payment") return order.status; // 2回目の通知は何もしない
    const pRef = db.collection("products").doc(order.items[0].productId);
    const pSnap = await tx.get(pRef);
    const product = pSnap.exists ? ({ ...(pSnap.data() as Omit<Product, "id">), id: pSnap.id } as Product) : null;
    const r = settlePayment(order, product);
    const now = Date.now();
    const event: MailEvent = r.status === "paid" ? "paid" : "cancelled_sold_out";
    const next = { ...order, status: r.status, ...(r.status === "cancelled" ? { cancelledAtMs: now } : {}) };
    const mails = [...(order.mails ?? []), ...mailsFor(next, event, shop.shopName, statusUrl(origin, order), now)];
    if (r.newStock !== null) tx.update(pRef, { stock: r.newStock });
    tx.update(oRef, { status: r.status, mails, ...(r.status === "cancelled" ? { cancelledAtMs: now } : {}) });
    return r.status;
  });
}

export const testPay = onCall(async (req) => {
  if (!isEmulator) throw new HttpsError("permission-denied", "練習用でだけ使えます");
  const order = await loadOrderWithToken(req.data?.orderId, req.data?.token);
  return { status: await markPaid(order.id, siteOrigin(req)) };
});

export const getOrderStatus = onCall(async (req) => {
  const o = await loadOrderWithToken(req.data?.orderId, req.data?.token);
  // お客さんに見せるのは、注文の中身と状況だけ（住所の細かいところやメールは返さない）
  return {
    number: o.number,
    status: o.status,
    createdAtMs: o.createdAtMs,
    items: o.items,
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
    leadDays: o.leadDays ?? null,
    carrier: o.carrier ?? null,
    trackingNumber: o.trackingNumber ?? null,
    shippedAtMs: o.shippedAtMs ?? null,
    completedAtMs: o.completedAtMs ?? null,
    name: o.address.name,
    prefecture: o.address.prefecture,
  };
});

export const confirmReceived = onCall(async (req) => {
  const o = await loadOrderWithToken(req.data?.orderId, req.data?.token);
  if (o.status !== "shipped") throw new HttpsError("failed-precondition", "発送済みの注文だけ「受け取りました」を押せます");
  const now = Date.now();
  const shop = await publicSettings();
  const next = { ...o, status: "completed" as const, completedAtMs: now };
  await getFirestore()
    .collection("orders")
    .doc(o.id)
    .update({ status: "completed", completedAtMs: now, mails: [...(o.mails ?? []), ...mailsFor(next, "completed", shop.shopName, statusUrl(siteOrigin(req), o), now)] });
  return { status: "completed" };
});
