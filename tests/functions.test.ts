// サーバー側の金額計算を、練習用 Firebase の上で実際に呼んで確かめる
import { initializeApp as initAdmin } from 'firebase-admin/app'
import { getFirestore as adminDb } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase/app'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { beforeAll, describe, expect, it } from 'vitest'
import { sampleProducts, sampleShippingTables } from '../web/src/data/sampleData.ts'

const projectId = process.env.GCLOUD_PROJECT ?? 'demo-handmade-pet-goods'

beforeAll(async () => {
  const db = adminDb(initAdmin({ projectId }, 'seed'))
  for (const { id, ...t } of sampleShippingTables) await db.doc(`shippingTables/${id}`).set(t)
  for (const { id, ...p } of sampleProducts) await db.doc(`products/${id}`).set(p)
})

const functions = getFunctions(initializeApp({ projectId, apiKey: 'demo-key' }), 'asia-northeast1')
connectFunctionsEmulator(functions, '127.0.0.1', 5001)
const quoteOrder = httpsCallable(functions, 'quoteOrder')

describe('金額の計算し直し（サーバー）', () => {
  it('3,000円＋Lサイズ500円＋北海道の送料1,200円＝4,700円', async () => {
    const res = await quoteOrder({ productId: 'sample-tsubosu', answers: { size: 'l' }, prefecture: '01' })
    expect(res.data).toMatchObject({ total: 4700, shipping: 1200, unitPrice: 3500 })
  })
  it('必須の選択肢がないと断る', async () => {
    await expect(quoteOrder({ productId: 'sample-tsubosu', answers: {}, prefecture: '01' })).rejects.toThrow('サイズ')
  })
  it('非公開の商品は断る', async () => {
    await expect(quoteOrder({ productId: 'sample-draft', answers: {}, prefecture: '13' })).rejects.toThrow()
  })
})
