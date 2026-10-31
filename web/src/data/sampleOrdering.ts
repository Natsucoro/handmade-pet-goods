// お試し表示（Firebase なし）での注文の流れ。サーバーと同じ決まり（@domain/checkout）を、ページの中で動かす。
import { checkCheckout, orderNumber, settlePayment, type CheckoutInput } from '@domain/checkout.ts'
import { mailsFor } from '@domain/mails.ts'
import type { Order } from '@domain/types.ts'
import { CheckoutError, type OrderStatusView, type PlacedOrder } from './ShopData.ts'
import { getSampleState, setSampleState } from './sampleStore.ts'

const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('')
const statusUrl = (o: Order) => `${location.origin}/orders/${o.id}?t=${o.viewToken}`

export async function samplePlaceOrder(input: CheckoutInput): Promise<PlacedOrder> {
  const st = getSampleState()
  const product = st.products.find((p) => p.id === input.productId)
  const table = product && st.shippingTables.find((t) => t.id === product.shippingTableId)
  if (!product || !table) throw new CheckoutError({ product: '商品が見つかりません' })
  const now = Date.now()
  const { errors, result } = checkCheckout(input, product, table, st.publicSettings, now)
  if (!result) throw new CheckoutError(errors)
  const day = orderNumber(now, 0).slice(0, 8)
  const seq = st.orders.filter((o) => o.number.startsWith(day)).length + 1
  const order: Order = { ...result.order, id: `o-${now.toString(36)}`, number: orderNumber(now, seq), viewToken: token() }
  setSampleState({ ...st, orders: [order, ...st.orders] })
  return { orderId: order.id, number: order.number, token: order.viewToken! }
}

function find(orderId: string, t: string): Order | null {
  const o = getSampleState().orders.find((x) => x.id === orderId)
  return o && o.viewToken === t ? o : null
}

export async function sampleTestPay(orderId: string, t: string): Promise<Order['status']> {
  const st = getSampleState()
  const order = find(orderId, t)
  if (!order) throw new Error('注文が見つかりません')
  if (order.status !== 'pending_payment') return order.status
  const product = st.products.find((p) => p.id === order.items[0].productId) ?? null
  const r = settlePayment(order, product)
  const now = Date.now()
  const next: Order = { ...order, status: r.status, ...(r.status === 'cancelled' ? { cancelledAtMs: now } : {}) }
  next.mails = [...(order.mails ?? []), ...mailsFor(next, r.status === 'paid' ? 'paid' : 'cancelled_sold_out', st.publicSettings.shopName, statusUrl(order), now)]
  setSampleState({
    ...st,
    orders: st.orders.map((o) => (o.id === orderId ? next : o)),
    products: st.products.map((p) => (p.id === product?.id && r.newStock !== null ? { ...p, stock: r.newStock } : p)),
  })
  return r.status
}

export async function sampleGetOrderStatus(orderId: string, t: string): Promise<OrderStatusView | null> {
  const o = find(orderId, t)
  if (!o) return null
  return {
    number: o.number, status: o.status, createdAtMs: o.createdAtMs, items: o.items, subtotal: o.subtotal, shipping: o.shipping, total: o.total,
    leadDays: o.leadDays ?? null, carrier: o.carrier ?? null, trackingNumber: o.trackingNumber ?? null, shippedAtMs: o.shippedAtMs ?? null,
    completedAtMs: o.completedAtMs ?? null, name: o.address.name, prefecture: o.address.prefecture,
  }
}

export async function sampleConfirmReceived(orderId: string, t: string): Promise<void> {
  const st = getSampleState()
  const o = find(orderId, t)
  if (!o || o.status !== 'shipped') throw new Error('発送済みの注文だけ「受け取りました」を押せます')
  const now = Date.now()
  const next: Order = { ...o, status: 'completed', completedAtMs: now }
  next.mails = [...(o.mails ?? []), ...mailsFor(next, 'completed', st.publicSettings.shopName, statusUrl(o), now)]
  setSampleState({ ...st, orders: st.orders.map((x) => (x.id === orderId ? next : x)) })
}
