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

describe('注文の流れ（サーバー）', () => {
  const createOrder = httpsCallable(functions, 'createOrder')
  const testPay = httpsCallable(functions, 'testPay')
  const getOrderStatus = httpsCallable(functions, 'getOrderStatus')
  const confirmReceived = httpsCallable(functions, 'confirmReceived')
  const input = {
    items: [{ productId: 'sample-pouch', answers: {}, quantity: 1 }],
    address: { name: 'にせ 太郎', postalCode: '1234567', prefecture: '13', address1: 'にせ区1-1' },
    email: 'taro@example.com',
  }
  const db = () => adminDb(initAdmin({ projectId }, `flow-${Math.random()}`))

  it('注文 → テスト決済 → 在庫が減る → 状況を見る → 発送 → 受け取り', async () => {
    const before = (await db().doc('products/sample-pouch').get()).data()!.stock as number
    const created = (await createOrder(input)).data as { orderId: string; number: string; token: string }
    expect(created.number).toMatch(/^\d{8}-\d{3}$/)
    // 画面の金額は使わず、サーバーで計算し直している（2,800円＋全国一律200円）
    let status = (await getOrderStatus({ orderId: created.orderId, token: created.token })).data as { status: string; total: number }
    expect(status).toMatchObject({ status: 'pending_payment', total: 3000 })

    expect((await testPay({ orderId: created.orderId, token: created.token })).data).toEqual({ status: 'paid' })
    expect((await db().doc('products/sample-pouch').get()).data()!.stock).toBe(before - 1)
    const saved = (await db().doc(`orders/${created.orderId}`).get()).data()!
    expect(saved.mails.map((m: { to: string }) => m.to)).toEqual(['customer', 'shop'])
    // 2回目の支払い通知では、在庫を二重に減らさない
    await testPay({ orderId: created.orderId, token: created.token })
    expect((await db().doc('products/sample-pouch').get()).data()!.stock).toBe(before - 1)

    await expect(confirmReceived({ orderId: created.orderId, token: created.token })).rejects.toThrow('発送済み')
    await db().doc(`orders/${created.orderId}`).update({ status: 'shipped', carrier: 'yamato', trackingNumber: '1' })
    await confirmReceived({ orderId: created.orderId, token: created.token })
    status = (await getOrderStatus({ orderId: created.orderId, token: created.token })).data as { status: string; total: number }
    expect(status.status).toBe('completed')
  })

  it('まとめ買い：同じ配送方法は送料1回分、違う配送方法は足す。在庫は商品ごとに減る', async () => {
    const before = (await db().doc('products/sample-tsubosu').get()).data()!.stock as number
    const created = (await createOrder({
      ...input,
      items: [
        { productId: 'sample-hammock', answers: { color: 'mint' }, quantity: 1 },
        { productId: 'sample-pouch', answers: {}, quantity: 1 },
        { productId: 'sample-tsubosu', answers: { size: 'm' }, quantity: 2 },
      ],
    })).data as { orderId: string; token: string }
    const status = (await getOrderStatus({ orderId: created.orderId, token: created.token })).data as { subtotal: number; shipping: number; items: unknown[] }
    // 2,400＋2,800＋3,000×2、送料は 全国一律200円（ハンモックとポーチで1回）＋ 60サイズ東京 870円
    expect(status).toMatchObject({ subtotal: 11200, shipping: 1070 })
    expect(status.items).toHaveLength(3)
    await testPay({ orderId: created.orderId, token: created.token })
    expect((await db().doc('products/sample-tsubosu').get()).data()!.stock).toBe(before - 2)
  })

  it('合言葉が違うと、注文は見られない', async () => {
    const created = (await createOrder(input)).data as { orderId: string }
    await expect(getOrderStatus({ orderId: created.orderId, token: 'wrong' })).rejects.toThrow('見つかりません')
    await expect(testPay({ orderId: created.orderId, token: 'wrong' })).rejects.toThrow('見つかりません')
  })

  it('入力がおかしいと、注文を作らない（どこがおかしいかを返す）', async () => {
    await expect(createOrder({ ...input, email: 'x', address: { ...input.address, name: '' } })).rejects.toThrow('入力を確かめて')
  })
})
