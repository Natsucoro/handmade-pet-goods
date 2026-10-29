import { sampleOrders } from '../data/sampleOrders.ts'
import { ORDER_TABS, nextStatus, shipmentError, statusPatch } from './orders.ts'

it('入金済み → 制作中 → 発送済み の順に進む', () => {
  expect(nextStatus('paid')).toBe('in_production')
  expect(nextStatus('in_production')).toBe('shipped')
  expect(nextStatus('shipped')).toBeNull()
})

it('発送済みにするには配送会社と追跡番号がいる（その他は番号なしでもよい）', () => {
  expect(shipmentError('', '123')).toBe('配送会社を選んでください')
  expect(shipmentError('yamato', ' ')).toBe('追跡番号を入れてください')
  expect(shipmentError('yamato', '1234')).toBeNull()
  expect(shipmentError('other', '')).toBeNull()
})

it('発送済みにすると、配送会社・追跡番号・発送日を残す', () => {
  const o = sampleOrders[1]
  expect(statusPatch(o, 'shipped', 1000, { carrier: 'sagawa', trackingNumber: ' 999 ' })).toEqual({
    status: 'shipped', carrier: 'sagawa', trackingNumber: '999', shippedAtMs: 1000,
  })
})

it('どの状態の注文も、どれかの見出しに入る', () => {
  const all = ORDER_TABS.find((t) => t.id === 'all')!.statuses as readonly string[]
  for (const o of sampleOrders) expect(all).toContain(o.status)
})

it('期間を短くしたときに、すぐ消える注文の数', async () => {
  const { countPurgeable } = await import('./orders.ts')
  const done = { ...sampleOrders[3], completedAtMs: Date.UTC(2026, 0, 10) }
  const now = Date.UTC(2026, 9, 29)
  expect(countPurgeable([done], 24, now)).toBe(0)
  expect(countPurgeable([done], 6, now)).toBe(1)
  expect(countPurgeable([sampleOrders[0]], 3, now)).toBe(0) // まだ終わっていない注文は消さない
})

it('日時は日本時間で出す', async () => {
  const { formatDate } = await import('./orders.ts')
  expect(formatDate(Date.UTC(2026, 9, 29, 12, 5))).toBe('10月29日 21:05')
})
