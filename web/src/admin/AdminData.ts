import type { Category, Product, ProductPhoto, ShippingTable, ShopSettings } from '@domain/types.ts'
import type { PreparedImage } from './images.ts'

/** 編集中の写真。もう保存してあるもの（existing）か、これから上げるもの（pending） */
export interface PhotoDraft {
  key: string
  caption: string
  existing?: ProductPhoto
  pending?: PreparedImage
}

/** 管理画面が読み書きするデータ */
export interface AdminData {
  /** 公開・非公開を含めた全部の商品（表示順） */
  listProducts(): Promise<Product[]>
  getProduct(id: string): Promise<Product | null>
  newId(): string
  /** 商品を保存する。新しい写真を上げ、外した写真は消す */
  saveProduct(product: Omit<Product, 'photos'>, photos: PhotoDraft[], removed: ProductPhoto[]): Promise<Product>
  deleteProduct(product: Product): Promise<void>
  /** 並べた順に表示順を付け直す */
  saveProductOrder(ids: string[]): Promise<void>

  listCategories(): Promise<Category[]>
  saveCategory(c: Category): Promise<void>
  deleteCategory(id: string): Promise<void>
  saveCategoryOrder(ids: string[]): Promise<void>

  listShippingTables(): Promise<ShippingTable[]>
  saveShippingTable(t: ShippingTable): Promise<void>
  deleteShippingTable(id: string): Promise<void>

  getSettings(): Promise<ShopSettings>
  saveSettings(s: ShopSettings): Promise<void>
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'notAdmin'; email: string; uid: string }
  | { status: 'admin'; email: string }

/** 管理画面のログイン */
export interface AdminSession {
  get(): SessionState
  subscribe(cb: (s: SessionState) => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>
}

export class AdminError extends Error {}
