import { DATA_MODE } from '../config.ts'
import type { ShopData } from './ShopData.ts'
import { sampleConfirmReceived, sampleGetOrderStatus, samplePlaceOrder, sampleTestPay } from './sampleOrdering.ts'
import { getSampleState } from './sampleStore.ts'

/** Firebase を使わず、お試しデータを返す（管理画面のお試しで変えた内容も反映される） */
// お試し表示では、本物の通信と同じくらい少し待ってから出す（読み込み中の見た目を確かめられるように）
const wait = () => (DATA_MODE === 'sample' ? new Promise((r) => setTimeout(r, 450)) : Promise.resolve())

export function createSampleShopData(): ShopData {
  const published = () => getSampleState().products.filter((p) => p.published)
  return {
    async listProducts() {
      await wait()
      return [...published()].sort((a, b) => b.createdAtMs - a.createdAtMs)
    },
    async getProduct(id) {
      await wait()
      return published().find((p) => p.id === id) ?? null
    },
    async getShippingTable(id) {
      return getSampleState().shippingTables.find((t) => t.id === id) ?? null
    },
    async listCategories() {
      return [...getSampleState().categories].sort((a, b) => a.sortOrder - b.sortOrder)
    },
    async getPublicSettings() {
      return getSampleState().publicSettings
    },
    refresh() {},
    async placeOrder(input) {
      await wait()
      return samplePlaceOrder(input)
    },
    async testPay(orderId, token) {
      await wait()
      return sampleTestPay(orderId, token)
    },
    async getOrderStatus(orderId, token) {
      await wait()
      return sampleGetOrderStatus(orderId, token)
    },
    confirmReceived: sampleConfirmReceived,
  }
}
