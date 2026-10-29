// Firebase との接続を1つにまとめる（お店の画面と管理画面で同じものを使う）。
import type { FirebaseApp } from 'firebase/app'
import { initializeApp } from 'firebase/app'
import { DATA_MODE, DEMO_PROJECT_ID } from '../config.ts'
import { initAnalytics } from '../lib/analytics.ts'

let appPromise: Promise<FirebaseApp> | null = null

export function getFirebaseApp(): Promise<FirebaseApp> {
  if (DATA_MODE === 'sample') return Promise.reject(new Error('お試し表示では Firebase を使いません'))
  appPromise ??= (async () => {
    if (DATA_MODE === 'hosting') {
      // Firebase Hosting が用意する設定を読む（リポジトリに設定を書かなくて済む）
      const res = await fetch('/__/firebase/init.json')
      if (!res.ok) throw new Error('Firebase の設定を読めませんでした')
      const config = await res.json()
      const app = initializeApp(config)
      await initAnalytics(app, config.measurementId)
      return app
    }
    // 練習用。demo- で始まるので本物にはつながらない
    return initializeApp({
      projectId: DEMO_PROJECT_ID,
      apiKey: 'demo-key',
      appId: 'demo-app',
      authDomain: `${DEMO_PROJECT_ID}.firebaseapp.com`,
      storageBucket: `${DEMO_PROJECT_ID}.appspot.com`,
    })
  })()
  return appPromise
}

/** 練習用のときの接続先（スマホから同じ Wi-Fi で開いたときも動くように、開いているホスト名を使う） */
export const EMULATOR_HOST = typeof location === 'undefined' ? '127.0.0.1' : location.hostname
