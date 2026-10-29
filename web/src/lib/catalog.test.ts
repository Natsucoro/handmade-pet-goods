import { sampleCategories, sampleProducts } from '../data/sampleData.ts'
import {
  EMPTY_FILTERS,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  groupCategories,
  normalizeText,
  type Filters,
} from './catalog.ts'

const published = sampleProducts.filter((p) => p.published)
const names = (f: Partial<Filters>) =>
  applyFilters(published, { ...EMPTY_FILTERS, ...f }, sampleCategories).map((p) => p.id.replace('sample-', ''))

describe('並び替え', () => {
  it('最初はお姉ちゃんが決めた表示順（売り切れもその位置）', () =>
    expect(names({})).toEqual(['tsubosu', 'pouch', 'hammock', 'oyatsu', 'perch']))
  it('新着順', () => expect(names({ sort: 'new' })).toEqual(['tsubosu', 'hammock', 'pouch', 'oyatsu', 'perch']))
  it('安い順・高い順', () => {
    expect(names({ sort: 'price_asc' })).toEqual(['perch', 'oyatsu', 'hammock', 'pouch', 'tsubosu'])
    expect(names({ sort: 'price_desc' })).toEqual(['tsubosu', 'pouch', 'hammock', 'oyatsu', 'perch'])
  })
})

describe('絞り込み', () => {
  it('カテゴリ', () => {
    expect(names({ categoryId: 'sample-cat-buncho' })).toEqual(['tsubosu', 'oyatsu', 'perch'])
    expect(names({ categoryId: 'sample-cat-nest' })).toEqual(['tsubosu', 'pouch', 'hammock'])
  })
  it('すぐ届くもの（在庫あり）だけ', () => expect(names({ inStockOnly: true })).toEqual(['tsubosu', 'pouch']))
  it('値段の範囲（2,000円ちょうどは「2,000〜2,999円」に入る）', () => {
    expect(names({ price: 'u2000' })).toEqual(['oyatsu', 'perch'])
    expect(names({ price: '2000-2999' })).toEqual(['pouch', 'hammock'])
    expect(names({ price: 'o3000' })).toEqual(['tsubosu'])
  })
  it('キーワード（説明文・カテゴリ名も探す。カタカナとひらがな、全角と半角の違いは気にしない）', () => {
    expect(names({ keyword: 'つぼ巣' })).toEqual(['tsubosu'])
    expect(names({ keyword: 'ふわふわ' })).toEqual(['pouch'])
    expect(names({ keyword: 'ももんが' })).toEqual(['pouch'])
    expect(names({ keyword: 'ﾓﾓﾝｶﾞ' })).toEqual(['pouch'])
    // つぼ巣は説明文に「オカメインコの若鳥」とあるので当てはまる
    expect(names({ keyword: 'おかめいんこ' })).toEqual(['tsubosu', 'hammock', 'perch'])
    expect(names({ keyword: 'きりん' })).toEqual([])
    expect(names({ keyword: '文鳥 おやつ' })).toEqual(['oyatsu'])
  })
  it('条件の組み合わせ', () =>
    expect(names({ categoryId: 'sample-cat-buncho', inStockOnly: true })).toEqual(['tsubosu']))
  it('当てはまるものがなければ空', () => expect(names({ categoryId: 'sample-cat-momonga', price: 'u2000' })).toEqual([]))
})

describe('URL との行き来', () => {
  it('条件を URL にして、戻すと同じ条件になる', () => {
    const f: Filters = { categoryId: 'sample-cat-okame', inStockOnly: true, price: 'o3000', keyword: 'ねぶくろ', sort: 'price_asc' }
    expect(filtersFromParams(filtersToParams(f))).toEqual(f)
  })
  it('何も付いていなければ URL も空', () => expect(filtersToParams(EMPTY_FILTERS).toString()).toBe(''))
  it('おかしな値は無視する', () =>
    expect(filtersFromParams(new URLSearchParams('sort=xx&price=yy'))).toEqual(EMPTY_FILTERS))
})

it('文字をそろえる', () => expect(normalizeText('ＡＢＣ　モモンガ')).toBe('abc ももんが'))

it('カテゴリをまとまりごとに分ける', () =>
  expect(groupCategories(sampleCategories).map((g) => [g.group, g.items.length])).toEqual([
    ['アニマル', 3],
    ['カテゴリ', 3],
  ]))
