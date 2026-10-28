import type { Product } from '@domain/types.ts'
import { availabilityLabel, availabilityOf } from './availability.ts'

type Stock = Pick<Product, 'stockType' | 'stock' | 'whenSoldOut' | 'leadDays'>
const base: Stock = { stockType: 'stock', stock: 10, whenSoldOut: 'sold_out', leadDays: 7 }
const label = (p: Partial<Stock>) => availabilityLabel(availabilityOf({ ...base, ...p }))

describe('在庫の表示', () => {
  it('在庫が多いときは「在庫あり」', () => expect(label({ stock: 10 })).toBe('在庫あり'))
  it('3個以下は「残り◯個」', () => {
    expect(label({ stock: 3 })).toBe('残り3個')
    expect(label({ stock: 1 })).toBe('残り1個')
  })
  it('0個で「売り切れにする」設定なら売り切れ', () => expect(label({ stock: 0 })).toBe('売り切れ'))
  it('0個で「受注生産に切り替える」設定なら受注生産', () =>
    expect(label({ stock: 0, whenSoldOut: 'made_to_order' })).toBe('受注生産（約7日でお届け）'))
  it('受注生産の商品は在庫数に関係なく受注生産', () =>
    expect(label({ stockType: 'made_to_order', stock: 0, leadDays: 14 })).toBe('受注生産（約14日でお届け）'))
})
