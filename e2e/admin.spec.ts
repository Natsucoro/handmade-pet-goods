// 管理画面を、練習用 Firebase の上で実際に動かす（本物の Firebase では動かさない）
import { expect, test, type Page } from '@playwright/test'
import { makePng } from './fixtures.ts'

const shots = process.env.SCREENSHOT_DIR
const PROJECT = 'demo-handmade-pet-goods'

test.skip(!!process.env.BASE_URL, '管理画面のテストは練習用でだけ動かす')

async function becomeAdmin(page: Page) {
  await page.goto('/admin')
  await expect(page.getByRole('button', { name: 'Google でログイン' })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/a0-login.png` })
  await page.evaluate(() => (window as unknown as { __testSignIn: (e: string) => Promise<unknown> }).__testSignIn('ane@example.com'))
  const uid = (await page.locator('code').textContent())!.trim()
  // 練習用のデータベースに、管理者の書類を直接作る（本物ではアプリから作れない）
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/admins?documentId=${uid}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { note: { stringValue: 'テスト' } } }),
  })
  expect(res.ok).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /商品（/ })).toBeVisible()
}

test('管理画面：カテゴリ・送料表・写真つき商品を登録すると、お店に出る', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const wasm: string[] = []
  page.on('request', (r) => { if (r.url().endsWith('.wasm')) wasm.push(r.url()) })
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('BROWSER', m.type(), m.text().slice(0, 300)) })
  await becomeAdmin(page)
  if (shots) await page.screenshot({ path: `${shots}/a1-products.png`, fullPage: true })

  // カテゴリを追加
  await page.getByRole('link', { name: 'カテゴリ' }).click()
  await page.getByRole('button', { name: '＋ カテゴリを追加' }).click()
  await page.getByLabel('カテゴリの名前').fill('ハリネズミ')
  await page.getByRole('button', { name: 'アニマル', exact: true }).click()
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText('ハリネズミ')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/a2-categories.png`, fullPage: true })

  // 送料表を追加（都道府県ごと：地方でまとめて入れてから、東京だけ直す）
  await page.getByRole('link', { name: '送料表' }).click()
  await page.getByRole('link', { name: '＋ 送料表を追加' }).click()
  await page.getByLabel('名前').fill('テスト便')
  await page.getByText('都道府県ごと').click()
  for (const r of ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州', '沖縄']) {
    await page.getByLabel(`${r}の送料`).fill(r === '北海道' || r === '沖縄' ? '1500' : '900')
  }
  await page.getByRole('button', { name: '関東を県ごとに直す' }).click()
  await page.getByLabel('東京都の送料').fill('800')
  if (shots) await page.screenshot({ path: `${shots}/a3-shipping.png`, fullPage: true })
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText('都道府県ごと 800円〜1,500円')).toBeVisible()

  // 商品を追加
  await page.getByRole('link', { name: '商品' }).click()
  await page.getByRole('link', { name: '＋ 商品を追加' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: makePng(2000, 1500) })
  await expect(page.getByRole('img', { name: '写真1' })).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('写真1の説明').fill('正面から')
  await page.getByLabel('商品名').fill('ハリネズミの寝袋')
  await page.getByLabel('基本の値段（円・税込）').fill('２,５００')
  await page.getByText('お店に公開する').click()
  await page.getByLabel('送料表').selectOption({ label: 'テスト便' })
  await page.getByRole('button', { name: 'ハリネズミ' }).click()

  // 説明文：打ってから一部を選んで太字にする
  const editor = page.getByRole('textbox', { name: '商品の説明' })
  await editor.click()
  await page.keyboard.type('ふわふわの寝袋です')
  await page.evaluate(() => {
    const el = document.querySelector('.rte-area')!
    const t = el.querySelector('p')!.firstChild!
    const node = t.nodeType === Node.TEXT_NODE ? t : t.firstChild!
    const r = document.createRange()
    r.setStart(node, 0)
    r.setEnd(node, 4)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(r)
  })
  await page.getByRole('button', { name: '太' }).click()
  if (shots) await page.screenshot({ path: `${shots}/a4-editor.png` })
  await expect(editor.locator('[data-b]')).toHaveText('ふわふわ')

  // 質問：サイズ（M／L +500円）
  await page.getByRole('button', { name: '＋ 質問を追加' }).click()
  await page.getByLabel('質問の文').fill('サイズ')
  await page.getByLabel('選択肢1の名前').fill('M')
  await page.getByRole('button', { name: '＋ 選択肢を追加' }).click()
  await page.getByLabel('選択肢2の名前').fill('L')
  await page.getByLabel('選択肢2の追加料金').fill('500')
  if (shots) await page.screenshot({ path: `${shots}/a5-product-form.png`, fullPage: true })
  await page.getByRole('button', { name: '保存する' }).click()

  await expect(page.getByRole('heading', { name: /商品（/ })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('ハリネズミの寝袋')).toBeVisible()

  // お店の画面に出ているか
  await page.getByRole('link', { name: 'お店を見る' }).click()
  await page.getByRole('button', { name: 'ハリネズミ' }).click()
  await expect(page.locator('.product-grid > li')).toHaveCount(1)
  await page.locator('.product-grid > li').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ハリネズミの寝袋')
  await expect(page.getByText('+500円')).toBeVisible()
  await expect(page.locator('.rich-text strong')).toHaveText('ふわふわ')
  await expect(page.getByText('正面から')).toBeVisible()
  // 写真は WebP で、長い辺1600pxに縮んでいる
  const img = page.getByRole('img', { name: '正面から' })
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600)
  expect(await img.getAttribute('src')).toMatch(/\.webp/)
  await page.getByRole('combobox', { name: 'お届け先の都道府県' }).selectOption('13')
  await expect(page.locator('.shipping-result')).toHaveText('送料 800円')
  if (shots) await page.screenshot({ path: `${shots}/a6-shop-new-product.png`, fullPage: true })
  // 写真を外して保存すると、写真置き場からも消える
  const listFiles = async () => {
    const r = await fetch(`http://127.0.0.1:9199/v0/b/${PROJECT}.appspot.com/o?prefix=products/`, { headers: { Authorization: 'Bearer owner' } })
    return ((await r.json()).items ?? []) as { name: string }[]
  }
  expect((await listFiles()).length).toBe(2) // 1600px と 600px
  await page.goto('/admin')
  await page.getByRole('link', { name: /ハリネズミの寝袋/ }).click()
  await page.getByRole('button', { name: '外す' }).first().click()
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByRole('heading', { name: /商品（/ })).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => (await listFiles()).length).toBe(0)

  expect(errors).toEqual([])
  // 写真の変換は jSquash（どのブラウザでも同じ変換プログラム）で行った
  expect(wasm.some((u) => /webp_enc/.test(u))).toBe(true)
})
