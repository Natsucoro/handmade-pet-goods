import type { ShopData } from './ShopData.ts'
import { getSampleState } from './sampleStore.ts'

/** Firebase を使わず、お試しデータを返す（管理画面のお試しで変えた内容も反映される） */
export function createSampleShopData(): ShopData {
  const published = () => getSampleState().products.filter((p) => p.published)
  return {
    async listProducts() {
      return [...published()].sort((a, b) => b.createdAtMs - a.createdAtMs)
    },
    async getProduct(id) {
      return published().find((p) => p.id === id) ?? null
    },
    async getShippingTable(id) {
      return getSampleState().shippingTables.find((t) => t.id === id) ?? null
    },
    async listCategories() {
      return [...getSampleState().categories].sort((a, b) => a.sortOrder - b.sortOrder)
    },
    refresh() {},
  }
}
