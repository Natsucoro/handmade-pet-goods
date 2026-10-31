import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite'
import { DATA_MODE } from '../config.ts'
import type { ShopData } from './ShopData.ts'
import { EMULATOR_HOST, getFirebaseApp } from './firebaseApp.ts'
import { createFirestoreShopData } from './firestoreShopData.ts'
import { createSampleShopData } from './sampleShopData.ts'

/** 設定に合わせてデータの読み方を作る */
export async function createShopData(): Promise<ShopData> {
  if (DATA_MODE === 'sample') return createSampleShopData()
  const app = await getFirebaseApp()
  const db = getFirestore(app)
  if (DATA_MODE === 'emulator') {
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080)
    // 注文の受け付け（サーバー）は、いまは練習用でだけ動かす。本物はステップ3（Stripe と Blaze）から
    const { getFunctions, connectFunctionsEmulator } = await import('firebase/functions')
    const functions = getFunctions(app, 'asia-northeast1')
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001)
    return createFirestoreShopData(db, functions)
  }
  return createFirestoreShopData(db)
}
