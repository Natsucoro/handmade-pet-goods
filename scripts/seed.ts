// お試しの商品データを Firestore に入れる（--remove で消す）。
//
// - 練習用（エミュレーター）: FIRESTORE_EMULATOR_HOST があるとき。`npm run seed`
// - 本物: SEED_REAL_PROJECT=<プロジェクトID> を付けたときだけ（GitHub Actions の「お試しデータ」から）。
//   入れるのは ID が sample- で始まるお試しの書類だけ。ほかの書類には触らない。
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { sampleCategories, sampleProducts, sampleShippingTables } from '../web/src/data/sampleData.ts'

const emulator = process.env.FIRESTORE_EMULATOR_HOST
const realProject = process.env.SEED_REAL_PROJECT
const projectId = emulator ? (process.env.GCLOUD_PROJECT ?? 'demo-handmade-pet-goods') : realProject
if (!projectId) {
  console.error('練習用 Firebase が動いていません（本物に入れるときは SEED_REAL_PROJECT を指定）')
  process.exit(1)
}
const remove = process.argv.includes('--remove')

initializeApp({ projectId })
const db = getFirestore()
const batch = db.batch()
for (const { id, ...table } of sampleShippingTables) {
  const ref = db.collection('shippingTables').doc(id)
  remove ? batch.delete(ref) : batch.set(ref, table)
}
for (const { id, ...category } of sampleCategories) {
  const ref = db.collection('categories').doc(id)
  remove ? batch.delete(ref) : batch.set(ref, category)
}
for (const { id, ...product } of sampleProducts) {
  const ref = db.collection('products').doc(id)
  remove ? batch.delete(ref) : batch.set(ref, product)
}
await batch.commit()
console.log(
  `${emulator ? '練習用' : '本物'}（${projectId}）に、お試しデータを${remove ? '消しました' : '入れました'}：` +
    `商品 ${sampleProducts.length} 件、カテゴリ ${sampleCategories.length} 件、送料表 ${sampleShippingTables.length} 件`,
)
