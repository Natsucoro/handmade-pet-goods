// データのルールのテスト：他人が読めない・書けないことを確かめる。
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules-firestore',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})
afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'admins/admin-uid'), { note: 'にせの管理者' })
    await setDoc(doc(db, 'products/open'), { name: '公開', published: true, createdAtMs: 2 })
    await setDoc(doc(db, 'products/draft'), { name: '非公開', published: false, createdAtMs: 1 })
    await setDoc(doc(db, 'shippingTables/t1'), { name: '送料表', mode: 'flat', flatFee: 200 })
    await setDoc(doc(db, 'categories/c1'), { name: '文鳥', group: 'どの子用', sortOrder: 1 })
    await setDoc(doc(db, 'orders/o1'), { name: 'にせ 太郎', address: 'にせの住所' })
    await setDoc(doc(db, 'customers/c1'), { name: 'にせ 花子' })
    await setDoc(doc(db, 'settings/shop'), { phone: 'optional' })
  })
})

const guest = () => env.unauthenticatedContext().firestore()
const stranger = () => env.authenticatedContext('stranger-uid').firestore()
const admin = () => env.authenticatedContext('admin-uid').firestore()

describe('お客さん（ログインなし・あり）', () => {
  for (const [who, db] of [['ログインなし', guest], ['ログインした他人', stranger]] as const) {
    it(`${who}：公開中の商品・カテゴリ・送料表は読める`, async () => {
      await assertSucceeds(getDocs(collection(db(), 'categories')))
      await assertSucceeds(getDoc(doc(db(), 'products/open')))
      await assertSucceeds(getDocs(query(collection(db(), 'products'), where('published', '==', true))))
      await assertSucceeds(getDoc(doc(db(), 'shippingTables/t1')))
    })
    it(`${who}：非公開の商品は読めない`, async () => {
      await assertFails(getDoc(doc(db(), 'products/draft')))
      await assertFails(getDocs(collection(db(), 'products')))
    })
    it(`${who}：注文・お客さん・設定・管理者の一覧は読めない`, async () => {
      await assertFails(getDoc(doc(db(), 'orders/o1')))
      await assertFails(getDocs(collection(db(), 'orders')))
      await assertFails(getDoc(doc(db(), 'customers/c1')))
      await assertFails(getDoc(doc(db(), 'settings/shop')))
      await assertFails(getDocs(collection(db(), 'admins')))
    })
    it(`${who}：商品や送料表を書き換えられない`, async () => {
      await assertFails(updateDoc(doc(db(), 'products/open'), { basePrice: 1 }))
      await assertFails(setDoc(doc(db(), 'products/new'), { name: 'x', published: true }))
      await assertFails(deleteDoc(doc(db(), 'products/open')))
      await assertFails(setDoc(doc(db(), 'shippingTables/t1'), { flatFee: 0 }))
      await assertFails(setDoc(doc(db(), 'categories/c1'), { name: 'x' }))
    })
  }
  it('自分を管理者にはできない', async () => {
    await assertFails(setDoc(doc(stranger(), 'admins/stranger-uid'), {}))
  })
})

describe('管理者（お姉ちゃん）', () => {
  it('非公開の商品も読めて、商品・送料表・設定を書ける', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'products/draft')))
    await assertSucceeds(getDocs(collection(admin(), 'products')))
    await assertSucceeds(setDoc(doc(admin(), 'products/new'), { name: '新商品', published: false }))
    await assertSucceeds(setDoc(doc(admin(), 'shippingTables/t2'), { name: '送料表2' }))
    await assertSucceeds(setDoc(doc(admin(), 'categories/c2'), { name: 'おもちゃ', group: '種類', sortOrder: 2 }))
    await assertSucceeds(setDoc(doc(admin(), 'settings/shop'), { phone: 'required' }))
  })
  it('管理者を増やすことはアプリからはできない', async () => {
    await assertFails(setDoc(doc(admin(), 'admins/someone'), {}))
  })
})
