// お客さんの注文から、お姉ちゃんの発送、お客さんの「受け取りました」まで、一通り動かす（練習用 Firebase だけ）
import { expect, test } from '@playwright/test'
import { becomeAdmin } from './fixtures.ts'

const shots = process.env.SCREENSHOT_DIR

test.skip(!!process.env.BASE_URL, '注文のテストは練習用でだけ動かす（本物ではまだ注文を受け付けない）')

test('注文 → テストのお支払い → 管理画面で発送 → お客さんが受け取り', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // 商品ページで選ぶ
  await page.goto('/products/sample-tsubosu')
  await expect(page.getByRole('heading', { name: 'ご注文' })).toBeVisible()
  await page.getByRole('button', { name: '購入手続きへ' }).click()
  await expect(page.getByRole('alert')).toHaveText('「サイズ」を選んでください')
  await page.getByRole('radio', { name: /^L/ }).check()
  await page.getByRole('button', { name: '1つ増やす' }).click()
  await expect(page.getByLabel('個数')).toHaveText('2')
  await expect(page.locator('.order-subtotal')).toContainText('7,000円')
  if (shots) await page.screenshot({ path: `${shots}/o1-product-order.png` })
  await page.getByRole('button', { name: '購入手続きへ' }).click()

  // お届け先
  await expect(page).toHaveURL(/\/checkout\/sample-tsubosu$/)
  await expect(page.getByRole('heading', { name: '購入手続き' })).toBeVisible()
  await expect(page.locator('.co-answers')).toContainText('L')
  await page.getByRole('button', { name: 'お支払いへ' }).click()
  await expect(page.getByText('お名前を入れてください')).toBeVisible()
  await expect(page.getByText('メールアドレスを正しく入れてください')).toBeVisible()
  await page.getByLabel('お名前').fill('テスト 花子')
  await page.getByLabel('郵便番号').fill('１２３４５６７')
  await page.getByLabel('都道府県').selectOption('13')
  await page.getByLabel('市区町村・番地').fill('テスト市テスト町1-2-3')
  await page.getByLabel('メールアドレス').fill('hanako@example.com')
  await expect(page.locator('.totals .grand')).toContainText('合計')
  const total = (await page.locator('.totals .grand dd').textContent())!
  expect(total).toMatch(/円$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  if (shots) await page.screenshot({ path: `${shots}/o2-checkout.png`, fullPage: true })
  await page.getByRole('button', { name: /お支払いへ/ }).click()

  // テストのお支払い
  await expect(page).toHaveURL(/\/pay\//)
  await expect(page.getByText('本物のお金は動きません')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/o3-pay.png`, fullPage: true })
  await page.getByRole('button', { name: /支払う（テスト）/ }).click()

  // ありがとう画面
  await expect(page.getByRole('heading', { name: 'ご注文ありがとうございます' })).toBeVisible()
  const number = (await page.locator('.thanks strong').textContent())!
  expect(number).toMatch(/^\d{8}-\d{3}$/)
  await expect(page.locator('.order-msg')).toContainText('ご注文を受け付けました')
  if (shots) await page.screenshot({ path: `${shots}/o4-thanks.png`, fullPage: true })
  const statusUrl = page.url().replace('&thanks=1', '')

  // 在庫が2つ減っている（5 → 3）
  await page.goto('/products/sample-tsubosu')
  await expect(page.locator('.qty-row')).toContainText('残り3個')

  // この端末の注文一覧から開ける
  await page.getByRole('link', { name: 'ご注文の状況' }).click()
  await expect(page.getByRole('link', { name: new RegExp(number) })).toBeVisible()

  // 管理画面：注文を開いて、制作中 → 発送済み
  await becomeAdmin(page)
  await page.getByRole('link', { name: /テスト 花子/ }).first().click()
  await expect(page.getByRole('heading', { name: `注文 ${number}` })).toBeVisible()
  await expect(page.locator('.mail-subject')).toHaveCount(2)
  await page.getByRole('button', { name: '制作中にする' }).click()
  await expect(page.getByText('制作中にしました')).toBeVisible()
  await page.getByLabel('配送会社').selectOption('japanpost')
  await page.getByLabel('追跡番号').fill('1234-5678-9012')
  await page.getByRole('button', { name: '発送済みにする' }).click()
  await expect(page.getByText('発送済みにしました')).toBeVisible()
  await expect(page.locator('.mail-subject').last()).toContainText('発送')
  await page.locator('.mail-head').last().click()
  await expect(page.locator('.mail-body')).toContainText('1234-5678-9012')
  if (shots) await page.screenshot({ path: `${shots}/o5-admin-shipped.png`, fullPage: true })

  // お客さん：注文の状況 → 受け取りました
  await page.goto(statusUrl)
  await expect(page.locator('.order-msg')).toContainText('発送しました')
  await expect(page.locator('.ship-info')).toContainText('日本郵便・追跡番号 1234-5678-9012')
  await page.getByRole('button', { name: '受け取りました' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '受け取りました' }).click()
  await expect(page.locator('.order-msg')).toContainText('お届けが終わりました')
  if (shots) await page.screenshot({ path: `${shots}/o6-received.png`, fullPage: true })

  // 合言葉がちがうと見られない
  await page.goto(statusUrl.replace(/t=[^&]+/, 't=wrong'))
  await expect(page.getByText('この注文は見つかりませんでした。', { exact: false })).toBeVisible()
  expect(errors).toEqual([])
})
