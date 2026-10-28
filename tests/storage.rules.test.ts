// 写真置き場のルールのテスト
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, setDoc } from 'firebase/firestore'
import { getBytes, ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeAll, describe, it } from 'vitest'

let env: RulesTestEnvironment
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46])

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // 写真のルールはデータ（admins）を見に行くので、エミュレーターと同じプロジェクトにする
    projectId: process.env.GCLOUD_PROJECT ?? 'demo-handmade-pet-goods',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins/admin-uid'), {})
    await uploadBytes(ref(ctx.storage(), 'products/p1/a.webp'), webp, { contentType: 'image/webp' })
    await uploadBytes(ref(ctx.storage(), 'private/secret.txt'), webp)
  })
})
afterAll(() => env.cleanup())

describe('商品写真', () => {
  it('だれでも見られる', async () => {
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), 'products/p1/a.webp')))
  })
  it('ログインなし・他人は置けない', async () => {
    await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), 'products/p1/b.webp'), webp, { contentType: 'image/webp' }))
    await assertFails(uploadBytes(ref(env.authenticatedContext('stranger').storage(), 'products/p1/b.webp'), webp, { contentType: 'image/webp' }))
  })
  it('管理者は WebP だけ置ける', async () => {
    const s = env.authenticatedContext('admin-uid').storage()
    await assertSucceeds(uploadBytes(ref(s, 'products/p1/c.webp'), webp, { contentType: 'image/webp' }))
    await assertFails(uploadBytes(ref(s, 'products/p1/c.jpg'), webp, { contentType: 'image/jpeg' }))
  })
})

describe('それ以外の場所', () => {
  it('だれも読めない', async () => {
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'private/secret.txt')))
    await assertFails(getBytes(ref(env.authenticatedContext('admin-uid').storage(), 'private/secret.txt')))
  })
})
