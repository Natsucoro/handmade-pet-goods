// お試し表示（Firebase なし）用の管理画面のデータ。保存はこの端末のブラウザの中だけ。
import type { Product } from '@domain/types.ts'
import { getSampleState, setSampleState } from '../data/sampleStore.ts'
import { AdminError, type AdminData, type AdminSession, type SessionState } from './AdminData.ts'

let counter = 0
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`

export function createSampleAdminData(): AdminData {
  const st = getSampleState
  const set = (patch: Partial<ReturnType<typeof st>>) => setSampleState({ ...st(), ...patch })
  return {
    async listProducts() {
      return [...st().products].sort((a, b) => a.sortOrder - b.sortOrder || b.createdAtMs - a.createdAtMs)
    },
    async getProduct(pid) {
      return st().products.find((p) => p.id === pid) ?? null
    },
    newId: () => id('p'),
    async saveProduct(product, photos) {
      const saved: Product = {
        ...product,
        photos: photos.map((d) =>
          d.existing
            ? { ...d.existing, caption: d.caption }
            : { url: d.pending!.previewUrl, thumbUrl: d.pending!.previewUrl, caption: d.caption },
        ),
      }
      const others = st().products.filter((p) => p.id !== product.id)
      set({ products: [...others, saved] })
      return saved
    },
    async deleteProduct(p) {
      set({ products: st().products.filter((x) => x.id !== p.id) })
    },
    async saveProductOrder(ids) {
      set({ products: st().products.map((p) => ({ ...p, sortOrder: ids.indexOf(p.id) === -1 ? p.sortOrder : ids.indexOf(p.id) + 1 })) })
    },
    async listCategories() {
      return [...st().categories].sort((a, b) => a.sortOrder - b.sortOrder)
    },
    async saveCategory(c) {
      set({ categories: [...st().categories.filter((x) => x.id !== c.id), c] })
    },
    async deleteCategory(cid) {
      set({
        categories: st().categories.filter((x) => x.id !== cid),
        products: st().products.map((p) => ({ ...p, categoryIds: p.categoryIds.filter((x) => x !== cid) })),
      })
    },
    async saveCategoryOrder(ids) {
      set({ categories: st().categories.map((c) => ({ ...c, sortOrder: ids.indexOf(c.id) + 1 || c.sortOrder })) })
    },
    async listShippingTables() {
      return [...st().shippingTables]
    },
    async saveShippingTable(t) {
      set({ shippingTables: [...st().shippingTables.filter((x) => x.id !== t.id), t] })
    },
    async deleteShippingTable(tid) {
      const used = st().products.filter((p) => p.shippingTableId === tid)
      if (used.length) throw new AdminError(`この送料表を使っている商品があります（${used.map((p) => p.name).join('、')}）`)
      set({ shippingTables: st().shippingTables.filter((x) => x.id !== tid) })
    },
    async getSettings() {
      return st().settings
    },
    async saveSettings(s) {
      set({ settings: s })
    },
    async getPublicSettings() {
      return st().publicSettings
    },
    async savePublicSettings(s) {
      set({ publicSettings: s })
    },
    async listOrders() {
      return [...st().orders].sort((a, b) => b.createdAtMs - a.createdAtMs)
    },
    async getOrder(oid) {
      return st().orders.find((o) => o.id === oid) ?? null
    },
    async updateOrder(oid, patch) {
      set({ orders: st().orders.map((o) => (o.id === oid ? { ...o, ...patch } : o)) })
    },
  }
}

/** お試しでは、ログインしたことにする */
export function createSampleSession(): AdminSession {
  let state: SessionState = { status: 'admin', email: 'お試しの管理者' }
  const subs = new Set<(s: SessionState) => void>()
  return {
    get: () => state,
    subscribe(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    async signIn() {
      state = { status: 'admin', email: 'お試しの管理者' }
      subs.forEach((cb) => cb(state))
    },
    async signOut() {
      state = { status: 'signedOut' }
      subs.forEach((cb) => cb(state))
    },
  }
}
