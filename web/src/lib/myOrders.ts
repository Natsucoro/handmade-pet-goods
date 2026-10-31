// この端末で注文したものを覚えておく（注文の状況ページへすぐ行けるように）。
// 覚えるのは注文番号と見るための合言葉だけ。住所などは入れない。
export interface MyOrder { orderId: string; number: string; token: string; createdAtMs: number }

const KEY = 'handmade-pet-goods:my-orders'

export function listMyOrders(): MyOrder[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function rememberOrder(o: MyOrder): void {
  try {
    const list = [o, ...listMyOrders().filter((x) => x.orderId !== o.orderId)].slice(0, 20)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // 覚えられなくても注文はできる
  }
}

export const orderStatusPath = (o: { orderId: string; token: string }) => `/orders/${encodeURIComponent(o.orderId)}?t=${encodeURIComponent(o.token)}`
