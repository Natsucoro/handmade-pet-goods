import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite'
import { DATA_MODE } from '../config.ts'
import type { ShopData } from './ShopData.ts'
import { EMULATOR_HOST, getFirebaseApp } from './firebaseApp.ts'
import { createFirestoreShopData } from './firestoreShopData.ts'
import { createSampleShopData } from './sampleShopData.ts'

/** 設定に合わせてデータの読み方を作る */
export async function createShopData(): Promise<ShopData> {
  if (DATA_MODE === 'sample') return createSampleShopData()
  const db = getFirestore(await getFirebaseApp())
  if (DATA_MODE === 'emulator') connectFirestoreEmulator(db, EMULATOR_HOST, 8080)
  return createFirestoreShopData(db)
}
