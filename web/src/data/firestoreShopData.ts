import type { Category, Product, ShippingTable } from '@domain/types.ts'
import type { Firestore } from 'firebase/firestore/lite'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite'
import type { ShopData } from './ShopData.ts'

// 開きっぱなしで見張り続ける読み方はしない（読み取り回数を増やさないため）。
// 一覧・カテゴリ・送料表は、ページを開いている間は1回読んだものを使い回す。
export function createFirestoreShopData(db: Firestore): ShopData {
  let products: Promise<Product[]> | null = null
  let categories: Promise<Category[]> | null = null
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
    refresh() {
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
