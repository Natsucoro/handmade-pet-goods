import type { Product, ShippingTable } from '@domain/types.ts'
import type { Firestore } from 'firebase/firestore/lite'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite'
import type { ShopData } from './ShopData.ts'

// 開きっぱなしで見張り続ける読み方はしない（読み取り回数を増やさないため）。必要なときに1回だけ読む。
export function createFirestoreShopData(db: Firestore): ShopData {
  return {
    async listProducts() {
      const q = query(
        collection(db, 'products'),
        where('published', '==', true),
        orderBy('createdAtMs', 'desc'),
        limit(100),
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ ...(d.data() as Omit<Product, 'id'>), id: d.id }))
    },
    async getProduct(id) {
      try {
        const snap = await getDoc(doc(db, 'products', id))
        if (!snap.exists()) return null
        return { ...(snap.data() as Omit<Product, 'id'>), id: snap.id }
      } catch (e) {
        // 非公開の商品はルールで読めない → 「見つからない」と同じ扱いにする
        if ((e as { code?: string }).code === 'permission-denied') return null
        throw e
      }
    },
    async getShippingTable(id) {
      const snap = await getDoc(doc(db, 'shippingTables', id))
      return snap.exists() ? { ...(snap.data() as Omit<ShippingTable, 'id'>), id: snap.id } : null
    },
  }
}
