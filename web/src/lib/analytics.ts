// Google アナリティクス。本物（hosting）でだけ動く。練習用・テスト・お試し表示では何もしない。
// お客さんの個人情報（名前・住所・メールなど）は送らない（Google の決まりでも禁止）。
import type { Product } from '@domain/types.ts'
import type { FirebaseApp } from 'firebase/app'
import type { Analytics } from 'firebase/analytics'

let analytics: Analytics | null = null
let logEventFn: typeof import('firebase/analytics').logEvent | null = null

/** 本物の設定に計測ID（measurementId）があるときだけ始める */
export async function initAnalytics(app: FirebaseApp, measurementId: string | undefined) {
  if (!measurementId) return
  try {
    const mod = await import('firebase/analytics')
    if (!(await mod.isSupported())) return
    // ページの切り替えは自分で送るので、自動の page_view は止める（二重に数えないため）
    analytics = mod.initializeAnalytics(app, { config: { send_page_view: false } })
    logEventFn = mod.logEvent
  } catch (e) {
    console.warn('アナリティクスを始められませんでした', e)
  }
}

export function trackPageView(path: string) {
  if (!analytics || !logEventFn) return
  logEventFn(analytics, 'page_view', {
    page_path: path,
    page_location: location.origin + path,
    page_title: document.title,
  })
}

/** 商品ページを見た（一覧→商品→購入 のどこで止まるかを見るため） */
export function trackViewItem(product: Product) {
  if (!analytics || !logEventFn) return
  logEventFn(analytics, 'view_item', {
    currency: 'JPY',
    value: product.basePrice,
    items: [{ item_id: product.id, item_name: product.name, price: product.basePrice }],
  })
}
