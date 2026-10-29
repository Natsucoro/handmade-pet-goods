import type { ShopData } from './ShopData.ts'
import { sampleCategories, sampleProducts, sampleShippingTables } from './sampleData.ts'

/** Firebase を使わず、お試しデータを返す */
export function createSampleShopData(): ShopData {
  const published = sampleProducts.filter((p) => p.published)
  return {
    async listProducts() {
      return [...published].sort((a, b) => b.createdAtMs - a.createdAtMs)
    },
    async getProduct(id) {
      return published.find((p) => p.id === id) ?? null
    },
    async getShippingTable(id) {
      return sampleShippingTables.find((t) => t.id === id) ?? null
    },
    async listCategories() {
      return [...sampleCategories].sort((a, b) => a.sortOrder - b.sortOrder)
    },
  }
}
