import type { Category, Product, ShippingTable } from '@domain/types.ts'

/** お客さんの画面が読むデータ。読み方（Firestore／お試し）を差し替えられるようにする */
export interface ShopData {
  /** 公開中の商品を新しい順に */
  listProducts(): Promise<Product[]>
  /** 公開中の商品を1つ。なければ null */
  getProduct(id: string): Promise<Product | null>
  getShippingTable(id: string): Promise<ShippingTable | null>
  /** カテゴリを表示順に */
  listCategories(): Promise<Category[]>
}
