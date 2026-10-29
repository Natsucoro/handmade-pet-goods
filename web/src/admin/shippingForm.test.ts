import { sampleShippingTables } from '../data/sampleData.ts'
import { draftToTable, feeTexts, fillRegion, regionValue } from './shippingForm.ts'

const box = sampleShippingTables[0]

it('地方ごとにまとめて入れて、県ごとに直せる', () => {
  let t = feeTexts(box)
  t = fillRegion(t, '関東', '900')
  expect(regionValue(t, '関東')).toBe('900')
  t = { ...t, '13': '800' }
  expect(regionValue(t, '関東')).toBeNull()
  const out = draftToTable({ id: 'x', name: 'ゆうパック60', mode: 'by_prefecture', flat: '', fees: t })
  expect(out.table?.fees?.['13']).toBe(800)
  expect(out.table?.fees?.['14']).toBe(900)
})

it('空の県があれば教える', () => {
  const t = { ...feeTexts(box), '47': '' }
  expect(draftToTable({ id: 'x', name: 'a', mode: 'by_prefecture', flat: '', fees: t }).error).toContain('沖縄県')
})

it('全国一律', () => {
  expect(draftToTable({ id: 'x', name: 'クリックポスト', mode: 'flat', flat: '185', fees: feeTexts(box) }).table).toEqual({
    id: 'x', name: 'クリックポスト', mode: 'flat', flatFee: 185,
  })
  expect(draftToTable({ id: 'x', name: '', mode: 'flat', flat: '185', fees: feeTexts(box) }).error).toBe('送料表の名前を入れてください')
})
