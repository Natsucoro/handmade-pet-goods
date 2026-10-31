import { expect, type Page } from '@playwright/test'
// テスト用のにせの写真（PNG）を作る
import { crc32, deflateSync } from 'node:zlib'

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}

/** 横 width × 縦 height の、上下で色が変わる PNG */
export function makePng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 8bit
  ihdr[9] = 2 // RGB
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const o = y * (width * 3 + 1)
    rows[o] = 0
    for (let x = 0; x < width; x++) {
      rows[o + 1 + x * 3] = 230
      rows[o + 2 + x * 3] = Math.round((y / height) * 200)
      rows[o + 3 + x * 3] = 150
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const PROJECT = 'demo-handmade-pet-goods'
const shots = process.env.SCREENSHOT_DIR

/** 練習用 Firebase で、テスト用の人を管理者にしてログインする */
export async function becomeAdmin(page: Page) {
  await page.goto('/admin')
  await expect(page.getByRole('button', { name: 'Google でログイン' })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/a0-login.png` })
  await page.evaluate(() => (window as unknown as { __testSignIn: (e: string) => Promise<unknown> }).__testSignIn('ane@example.com'))
  const ordersHeading = page.getByRole('heading', { name: '注文', exact: true })
  await expect(page.locator('code').or(ordersHeading)).toBeVisible()
  if (await ordersHeading.isVisible()) return // もう管理者になっている
  const uid = (await page.locator('code').textContent())!.trim()
  // 練習用のデータベースに、管理者の書類を直接作る（本物ではアプリから作れない）
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/admins?documentId=${uid}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { note: { stringValue: 'テスト' } } }),
  })
  expect(res.ok).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '注文', exact: true })).toBeVisible()
}

