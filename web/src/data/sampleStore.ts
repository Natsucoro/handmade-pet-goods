// お試し表示（Firebase なし）用の、ページの中だけのデータ置き場。
// 管理画面で変えた内容が、そのままお店の画面にも出る。
// この端末のブラウザにだけ保存する（写真は保存しないので、開き直すと消える）。
import { DEFAULT_PUBLIC_SETTINGS, DEFAULT_SHOP_SETTINGS, type Category, type Order, type Product, type PublicSettings, type ShippingTable, type ShopSettings } from '@domain/types.ts'
import { sampleCategories, sampleProducts, sampleShippingTables } from './sampleData.ts'
import { sampleOrders } from './sampleOrders.ts'

export interface SampleState {
  products: Product[]
  categories: Category[]
  shippingTables: ShippingTable[]
  settings: ShopSettings
  publicSettings: PublicSettings
  orders: Order[]
}

const KEY = 'handmade-pet-goods:sample-v2'

function initial(): SampleState {
  return structuredClone({
    products: sampleProducts,
    categories: sampleCategories,
    shippingTables: sampleShippingTables,
    settings: DEFAULT_SHOP_SETTINGS,
    publicSettings: DEFAULT_PUBLIC_SETTINGS,
    orders: sampleOrders,
  })
}

function load(): SampleState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as SampleState
  } catch {
    // 読めないときは最初の状態で始める
  }
  return initial()
}

let state: SampleState = load()

export function getSampleState(): SampleState {
  return state
}

export function setSampleState(next: SampleState) {
  state = next
  try {
    // 写真（blob: の URL）は開き直すと使えないので保存しない
    const forSave: SampleState = {
      ...next,
      products: next.products.map((p) => ({ ...p, photos: p.photos.filter((ph) => !ph.url.startsWith('blob:')) })),
    }
    localStorage.setItem(KEY, JSON.stringify(forSave))
  } catch {
    // 保存できなくても、このページを開いている間は使える
  }
}

/** お試しのデータを最初の状態に戻す */
export function resetSampleState() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 何もしない
  }
  state = initial()
}
