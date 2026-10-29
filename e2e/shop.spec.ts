import { expect, test } from '@playwright/test'

const shots = process.env.SCREENSHOT_DIR

// 本物のサイトを確かめるときは、アナリティクスに数えないように計測の通信を止める
test.beforeEach(async ({ page }) => {
  if (process.env.BLOCK_ANALYTICS) {
    await page.route(/google-analytics\.com|googletagmanager\.com|firebaselogging/, (r) => r.abort())
  }
})

test('商品一覧からつぼ巣のページを開き、送料を確かめる', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('.product-grid > li')
  await expect(cards).toHaveCount(5)
  await expect(cards.first()).toContainText('文鳥のつぼ巣（わら編み）')
  await expect(page.getByText('非公開')).toHaveCount(0)
  // 横にはみ出していない（スマホで横スクロールが出ない）
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  if (shots) await page.screenshot({ path: `${shots}/1-list.png`, fullPage: true })

  await cards.first().click()
  await expect(page).toHaveURL(/\/products\/sample-tsubosu$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('文鳥のつぼ巣（わら編み）')
  await expect(page.getByText('+500円')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/2-product-top.png` })

  // 写真を横にスワイプ（2枚目へ）
  await page.getByRole('button', { name: '2枚目の写真' }).click()
  await expect(page.getByRole('button', { name: '2枚目の写真' })).toHaveAttribute('aria-current', 'true')
  // 2枚目でぴったり止まる（前の写真がはみ出さない）
  await expect
    .poll(() => page.locator('.carousel-track').evaluate((el) => el.scrollLeft / el.clientWidth))
    .toBe(1)
  if (shots) await page.screenshot({ path: `${shots}/3-product-photo2.png` })

  await page.getByRole('combobox', { name: 'お届け先の都道府県' }).selectOption('01')
  await expect(page.locator('.shipping-result')).toHaveText('送料 1,200円')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  if (shots) await page.screenshot({ path: `${shots}/4-product-full.png`, fullPage: true })
})

test('URL を直接開いても商品ページが出る／ない商品は見つからない', async ({ page }) => {
  await page.goto('/products/sample-perch')
  await expect(page.getByRole('button', { name: '売り切れ' })).toBeDisabled()
  await page.goto('/products/sample-draft')
  await expect(page.getByText('この商品は見つかりませんでした。')).toBeVisible()
})

test('カテゴリと絞り込み → 商品ページ → 「一覧にもどる」で同じ条件・同じ位置に戻る', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '文鳥', exact: true }).click()
  await expect(page).toHaveURL(/\?cat=sample-cat-buncho$/)
  const cards = page.locator('.product-grid > li')
  await expect(cards).toHaveCount(3)
  await page.getByRole('button', { name: '絞り込み' }).click()
  if (shots) await page.screenshot({ path: `${shots}/5-filter-panel.png`, fullPage: true })
  await page.getByRole('button', { name: '3件を見る' }).click()

  // 下の方の商品を開く
  const last = cards.last()
  await last.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(0)
  await last.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('止まり木カバー 3本セット')
  if (shots) await page.screenshot({ path: `${shots}/6-product-backbar.png` })

  await page.getByRole('button', { name: /一覧にもどる/ }).first().click()
  await expect(page).toHaveURL(/\?cat=sample-cat-buncho$/)
  await expect(cards).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('キーワードで探す', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox').fill('ハンモック')
  await expect(page.locator('.product-grid > li')).toHaveCount(1)
  await expect(page).toHaveURL(/q=/)
})
