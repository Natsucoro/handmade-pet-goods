// どこのデータを使うか。
// - emulator: 練習用 Firebase（開発・自動テスト）。本物にはつながらない
// - hosting:  本物の Firebase（Firebase Hosting に置いたとき。設定は Hosting から自動で読む）
// - sample:   Firebase を使わず、お試しデータだけで表示する（スマホ確認用のお試し表示）
export type DataMode = 'emulator' | 'hosting' | 'sample'

const raw = import.meta.env.VITE_DATA_MODE
export const DATA_MODE: DataMode = raw === 'hosting' || raw === 'sample' ? raw : 'emulator'

/** 練習用 Firebase のプロジェクトID。demo- で始まるので本物にはつながらない */
export const DEMO_PROJECT_ID = 'demo-handmade-pet-goods'

/** 在庫がこの数以下なら「残り◯個」と出す */
export const LOW_STOCK = 3

/** 写真などのパスを、置き場所に合わせた URL にする */
export function assetUrl(path: string): string {
  if (/^(https?:|data:|blob:|\/)/.test(path)) return path
  return import.meta.env.BASE_URL + path
}

/** 注文を受け付けるか。本物は Stripe と Blaze の準備ができてから（ステップ3）。いまは練習用とお試し表示だけ */
export const CHECKOUT_ENABLED = DATA_MODE !== 'hosting'
