import type { Category, Product, PublicSettings, ShippingTable } from '@domain/types.ts'

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
}
