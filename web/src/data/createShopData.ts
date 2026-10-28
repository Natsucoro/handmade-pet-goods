import { initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite'
import { DATA_MODE, DEMO_PROJECT_ID } from '../config.ts'
import type { ShopData } from './ShopData.ts'
import { createFirestoreShopData } from './firestoreShopData.ts'
import { createSampleShopData } from './sampleShopData.ts'

/** 設定に合わせてデータの読み方を作る */
export async function createShopData(): Promise<ShopData> {
  if (DATA_MODE === 'sample') return createSampleShopData()

  if (DATA_MODE === 'hosting') {
    // Firebase Hosting が用意する設定を読む（リポジトリに設定を書かなくて済む）
    const res = await fetch('/__/firebase/init.json')
    if (!res.ok) throw new Error('Firebase の設定を読めませんでした')
    const app = initializeApp(await res.json())
    return createFirestoreShopData(getFirestore(app))
  }

  const app = initializeApp({ projectId: DEMO_PROJECT_ID, apiKey: 'demo-key', appId: 'demo-app' })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, location.hostname, 8080)
  return createFirestoreShopData(db)
}
