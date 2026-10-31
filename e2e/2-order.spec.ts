// お客さんの注文から、お姉ちゃんの発送、お客さんの「受け取りました」まで、一通り動かす（練習用 Firebase だけ）
import { expect, test } from '@playwright/test'
import { becomeAdmin } from './fixtures.ts'

const shots = process.env.SCREENSHOT_DIR

test.skip(!!process.env.BASE_URL, '注文のテストは練習用でだけ動かす（本物ではまだ注文を受け付けない）')

test('注文 → テストのお支払い → 管理画面で発送 → お客さんが受け取り', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // 商品ページで選んで、カートに入れる
  await page.goto('/products/sample-tsubosu')
  await expect(page.getByRole('heading', { name: 'ご注文' })).toBeVisible()
  await page.getByRole('button', { name: 'カートに入れる' }).click()
  await expect(page.getByRole('alert')).toHaveText('「サイズ」を選んでください')
  await page.getByRole('radio', { name: /^L/ }).check()
  await page.getByRole('button', { name: '1つ増やす' }).click()
  await expect(page.getByLabel('個数')).toHaveText('2')
  await expect(page.locator('.order-subtotal')).toContainText('7,000円')
  if (shots) await page.screenshot({ path: `${shots}/o1-product-order.png` })
  await page.getByRole('button', { name: 'カートに入れる' }).click()
  await expect(page.getByRole('dialog', { name: 'カートに入れました' })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/o1b-added.png` })
  await page.getByRole('button', { name: '買い物を続ける' }).click()
  await expect(page.getByRole('link', { name: 'カート（2点）' })).toBeVisible()

  // ほかの配送方法（全国一律）の商品を2つ入れる
  await page.goto('/products/sample-pouch')
  await page.getByRole('button', { name: 'カートに入れる' }).click()
  await page.getByRole('link', { name: 'カートを見る' }).click()
  await page.goto('/products/sample-hammock')
  await page.getByRole('radio', { name: 'ミント' }).check()
  await page.getByRole('button', { name: 'カートに入れる' }).click()
  await page.getByRole('link', { name: 'カートを見る' }).click()

  // カート：1つ削除（確かめてから消える）
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.locator('.cart-item')).toHaveCount(3)
  await page.getByRole('button', { name: /ハンモック.*をカートから削除/ }).click()
  await page.getByRole('button', { name: 'やめる' }).click()
  await expect(page.locator('.cart-item')).toHaveCount(3)
  await page.getByRole('button', { name: /ハンモック.*をカートから削除/ }).click()
  await page.getByRole('button', { name: '削除する' }).click()
  await expect(page.locator('.cart-item')).toHaveCount(2)
  await expect(page.locator('.totals .grand')).toContainText('9,800円')
  if (shots) await page.screenshot({ path: `${shots}/o1c-cart.png`, fullPage: true })
  // 「購入手続きへ」は、下のメニューのすぐ上にある（重ならない）
  const bar = await page.locator('.buy-bar').boundingBox()
  const nav = await page.locator('.bottom-nav').boundingBox()
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(nav!.y + 1)
  await page.getByRole('button', { name: '購入手続きへ' }).click()

  // お届け先
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByRole('heading', { name: '購入手続き' })).toBeVisible()
  await expect(page.locator('.co-item')).toHaveCount(2)
  await page.getByRole('button', { name: 'お支払いへ' }).click()
  await expect(page.getByText('お名前を入れてください')).toBeVisible()
  await expect(page.getByText('メールアドレスを正しく入れてください')).toBeVisible()
  await page.getByLabel('お名前').fill('テスト 花子')
  // 文字を打っている間は、下のメニューを隠す
  await expect(page.locator('.bottom-nav')).toBeHidden()
  await expect(page.getByText('お名前を入れてください')).toHaveCount(0)
  await page.getByLabel('郵便番号').fill('１２３４５６７')
  await page.getByLabel('都道府県').selectOption('13')
  await page.getByLabel('市区町村・番地').fill('テスト市テスト町1-2-3')
  await page.getByLabel('メールアドレス').fill('hanako@example.com')
  // 送料：60サイズ（東京870円）＋ 全国一律200円
  await expect(page.locator('.totals')).toContainText('1,070円')
  await expect(page.locator('.totals .grand')).toContainText('10,870円')
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

  // カートは空になり、在庫は商品ごとに減っている（つぼ巣 5 → 3、ポーチ 2 → 1）
  await expect(page.getByRole('link', { name: 'カート', exact: true })).toBeVisible()
  await page.goto('/products/sample-tsubosu')
  await expect(page.locator('.qty-row')).toContainText('残り3個')
  await page.goto('/products/sample-pouch')
  await expect(page.locator('.qty-row')).toContainText('残り1個')

  // この端末の注文一覧から開ける
  await page.getByRole('navigation', { name: 'メニュー' }).getByRole('link', { name: 'ご注文' }).click()
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
