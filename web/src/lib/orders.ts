// 注文の状態の名前と、次にできる操作（計画書「注文の状態」）。
import type { Carrier, Order, OrderStatus } from '@domain/types.ts'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: '支払い待ち',
  paid: '入金済み',
  in_production: '制作中',
  shipped: '発送済み',
  completed: '受け取り済み',
  cancelled: 'キャンセル',
}

export const CARRIER_LABEL: Record<Carrier, string> = {
  yamato: 'ヤマト運輸',
  sagawa: '佐川急便',
  japanpost: '日本郵便',
  other: 'その他',
}

/** 管理画面の注文一覧の分け方 */
export const ORDER_TABS = [
  { id: 'todo', label: '対応が必要', statuses: ['paid', 'in_production'] },
  { id: 'shipped', label: '発送済み', statuses: ['shipped'] },
  { id: 'done', label: '完了', statuses: ['completed', 'cancelled'] },
  { id: 'all', label: 'すべて', statuses: ['paid', 'in_production', 'shipped', 'completed', 'cancelled', 'pending_payment'] },
] as const satisfies readonly { id: string; label: string; statuses: readonly OrderStatus[] }[]

export type OrderTabId = (typeof ORDER_TABS)[number]['id']

/** その状態から、管理画面で進められる次の状態 */
export function nextStatus(s: OrderStatus): OrderStatus | null {
  if (s === 'paid') return 'in_production'
  if (s === 'in_production') return 'shipped'
  return null
}

/** 発送済みにするときに必要なものがそろっているか */
export function shipmentError(carrier: Carrier | '', tracking: string): string | null {
  if (!carrier) return '配送会社を選んでください'
  if (carrier !== 'other' && !tracking.trim()) return '追跡番号を入れてください'
  return null
}

/** 状態を変えたときに書き換える項目 */
export function statusPatch(order: Order, to: OrderStatus, now: number, ship?: { carrier: Carrier; trackingNumber: string }): Partial<Order> {
  if (to === 'shipped') return { status: to, carrier: ship?.carrier, trackingNumber: ship?.trackingNumber.trim() ?? '', shippedAtMs: order.shippedAtMs ?? now }
  if (to === 'completed') return { status: to, completedAtMs: now }
  if (to === 'cancelled') return { status: to, cancelledAtMs: now }
  return { status: to }
}

/** 日本時間で「10月29日 21:00」 */
export function formatDate(ms: number): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  )
  return `${p.month}月${p.day}日 ${p.hour}:${p.minute}`
}

/** 取引が終わった日（受け取り済み・キャンセル）。まだ終わっていなければ null */
export function finishedAtMs(o: Order): number | null {
  if (o.status === 'completed') return o.completedAtMs ?? null
  if (o.status === 'cancelled') return o.cancelledAtMs ?? null
  return null
}

/** 個人情報を消すまでの期間を months にしたとき、すぐ消える注文の数 */
export function countPurgeable(orders: Order[], months: number, now: number): number {
  const limit = new Date(now)
  limit.setMonth(limit.getMonth() - months)
  return orders.filter((o) => {
    const f = finishedAtMs(o)
    return f !== null && f < limit.getTime()
  }).length
}

export function monthsLabel(m: number): string {
  return m % 12 === 0 ? `${m / 12}年` : `${m}か月`
}
