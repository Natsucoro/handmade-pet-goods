import type { CheckoutErrors, CheckoutInput } from '@domain/checkout.ts'
import type { Category, Order, Product, PublicSettings, ShippingTable } from '@domain/types.ts'

/** お客さんが見られる注文の中身（住所の細かいところやメールは含まない） */
export type OrderStatusView = Pick<Order, 'number' | 'status' | 'createdAtMs' | 'items' | 'subtotal' | 'shipping' | 'total'> & {
  leadDays: number | null
  carrier: Order['carrier'] | null
  trackingNumber: string | null
  shippedAtMs: number | null
  completedAtMs: number | null
  name: string
  prefecture: string
}

export interface PlacedOrder { orderId: string; number: string; token: string }

/** 注文の入力がおかしいとき */
export class CheckoutError extends Error {
  errors: CheckoutErrors
  constructor(errors: CheckoutErrors) {
    super('入力を確かめてください')
    this.errors = errors
  }
}

/** お客さんの画面が読むデータ。読み方（Firestore／お試し）を差し替えられるようにする */
export interface ShopData {
  /** 公開中の商品を新しい順に */
  listProducts(): Promise<Product[]>
  /** 公開中の商品を1つ。なければ null */
  getProduct(id: string): Promise<Product | null>
  getShippingTable(id: string): Promise<ShippingTable | null>
  /** カテゴリを表示順に */
  listCategories(): Promise<Category[]>
  /** ショップ名など、お客さんにも見える設定 */
  getPublicSettings(): Promise<PublicSettings>
  /** 覚えておいた一覧などを捨てて、次に読むときに読み直す（管理画面で変えたあと） */
  refresh(): void

  /** 注文を作る（金額はサーバーで計算し直す）。入力がおかしければ CheckoutError */
  placeOrder(input: CheckoutInput): Promise<PlacedOrder>
  /** テスト決済（本物のお金は動かない）。本物の Stripe はステップ3でつなぐ */
  testPay(orderId: string, token: string): Promise<Order['status']>
  getOrderStatus(orderId: string, token: string): Promise<OrderStatusView | null>
  confirmReceived(orderId: string, token: string): Promise<void>
}
