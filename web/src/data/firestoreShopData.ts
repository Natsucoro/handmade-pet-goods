import { DEFAULT_PUBLIC_SETTINGS, type Category, type Product, type PublicSettings, type ShippingTable } from '@domain/types.ts'
import type { Firestore } from 'firebase/firestore/lite'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite'
import type { Functions } from 'firebase/functions'
import { httpsCallable } from 'firebase/functions'
import { CheckoutError, type OrderStatusView, type PlacedOrder, type ShopData } from './ShopData.ts'

// 開きっぱなしで見張り続ける読み方はしない（読み取り回数を増やさないため）。
// 一覧・カテゴリ・送料表は、ページを開いている間は1回読んだものを使い回す。
export function createFirestoreShopData(db: Firestore, functions?: Functions): ShopData {
  let products: Promise<Product[]> | null = null
  let categories: Promise<Category[]> | null = null
  let publicSettings: Promise<PublicSettings> | null = null
  const tables = new Map<string, Promise<ShippingTable | null>>()

  const listProducts = () => {
    products ??= getDocs(
      query(collection(db, 'products'), where('published', '==', true), orderBy('createdAtMs', 'desc'), limit(100)),
    ).then((snap) => snap.docs.map((d) => withDefaults({ ...(d.data() as Omit<Product, 'id'>), id: d.id })))
    products.catch(() => (products = null))
    return products
  }

  return {
    listProducts,
    async getProduct(id) {
      // 一覧をもう読んでいれば、その中から出す（読み取り回数を増やさない）
      if (products) {
        const found = (await products.catch(() => [])).find((p) => p.id === id)
        if (found) return found
      }
      try {
        const snap = await getDoc(doc(db, 'products', id))
        if (!snap.exists()) return null
        return withDefaults({ ...(snap.data() as Omit<Product, 'id'>), id: snap.id })
      } catch (e) {
        // 非公開の商品はルールで読めない → 「見つからない」と同じ扱いにする
        if ((e as { code?: string }).code === 'permission-denied') return null
        throw e
      }
    },
    getShippingTable(id) {
      if (!tables.has(id)) {
        tables.set(
          id,
          getDoc(doc(db, 'shippingTables', id)).then((snap) =>
            snap.exists() ? { ...(snap.data() as Omit<ShippingTable, 'id'>), id: snap.id } : null,
          ),
        )
      }
      return tables.get(id)!
    },
    listCategories() {
      categories ??= getDocs(collection(db, 'categories')).then((snap) =>
        snap.docs
          .map((d) => {
            const c = d.data() as Partial<Category>
            return { name: c.name ?? '', group: c.group ?? '', sortOrder: c.sortOrder ?? 0, id: d.id }
          })
          .sort((a, b) => a.sortOrder - b.sortOrder),
      )
      categories.catch(() => (categories = null))
      return categories
    },
    getPublicSettings() {
      publicSettings ??= getDoc(doc(db, 'settings', 'public')).then(
        (snap) => ({ ...DEFAULT_PUBLIC_SETTINGS, ...(snap.data() as Partial<PublicSettings> | undefined) }),
        () => DEFAULT_PUBLIC_SETTINGS,
      )
      return publicSettings
    },
    async placeOrder(input) {
      if (!functions) throw new Error('注文はまだ受け付けていません')
      try {
        return (await httpsCallable(functions, 'createOrder')(input)).data as PlacedOrder
      } catch (e) {
        const details = (e as { details?: { errors?: CheckoutError['errors'] } }).details
        if (details?.errors) throw new CheckoutError(details.errors)
        throw e
      }
    },
    async testPay(orderId, token) {
      if (!functions) throw new Error('注文はまだ受け付けていません')
      const r = await httpsCallable(functions, 'testPay')({ orderId, token })
      products = null
      return (r.data as { status: 'paid' | 'cancelled' }).status
    },
    async getOrderStatus(orderId, token) {
      if (!functions) return null
      try {
        return (await httpsCallable(functions, 'getOrderStatus')({ orderId, token })).data as OrderStatusView
      } catch (e) {
        if ((e as { code?: string }).code === 'functions/not-found') return null
        throw e
      }
    },
    async confirmReceived(orderId, token) {
      if (!functions) throw new Error('注文はまだ受け付けていません')
      await httpsCallable(functions, 'confirmReceived')({ orderId, token })
    },
    refresh() {
      publicSettings = null
      products = null
      categories = null
      tables.clear()
    },
  }
}

/** 古い形で保存された商品でも画面が動くように、足りない項目を補う */
function withDefaults(p: Product): Product {
  return { ...p, categoryIds: p.categoryIds ?? [], sortOrder: p.sortOrder ?? 0 }
}
