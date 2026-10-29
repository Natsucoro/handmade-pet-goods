// 商品一覧の絞り込みと並び替え。条件は URL（?cat=...&sort=...）に入れるので、
// 商品ページから「戻る」と同じ条件の一覧に戻れる。
import type { Category, Product, RichBlock } from '@domain/types.ts'
import { availabilityOf } from './availability.ts'

export type SortKey = 'recommended' | 'new' | 'price_asc' | 'price_desc'
export const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'おすすめ順',
  new: '新着順',
  price_asc: '安い順',
  price_desc: '高い順',
}

/** 値段の範囲（基本の値段で判定。max は含まない） */
export const PRICE_BANDS = [
  { id: 'u2000', label: '〜1,999円', min: 0, max: 2000 },
  { id: '2000-2999', label: '2,000〜2,999円', min: 2000, max: 3000 },
  { id: 'o3000', label: '3,000円〜', min: 3000, max: Infinity },
] as const
export type PriceBandId = (typeof PRICE_BANDS)[number]['id']

export interface Filters {
  categoryId: string | null
  /** すぐ届くもの（在庫ありの商品）だけ */
  inStockOnly: boolean
  price: PriceBandId | null
  keyword: string
  sort: SortKey
}

export const EMPTY_FILTERS: Filters = { categoryId: null, inStockOnly: false, price: null, keyword: '', sort: 'recommended' }

export function filtersFromParams(p: URLSearchParams): Filters {
  const sort = p.get('sort')
  const price = p.get('price')
  return {
    categoryId: p.get('cat') || null,
    inStockOnly: p.get('stock') === '1',
    price: PRICE_BANDS.some((b) => b.id === price) ? (price as PriceBandId) : null,
    keyword: p.get('q') ?? '',
    sort: sort && sort in SORT_LABELS ? (sort as SortKey) : 'recommended',
  }
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.categoryId) p.set('cat', f.categoryId)
  if (f.inStockOnly) p.set('stock', '1')
  if (f.price) p.set('price', f.price)
  if (f.keyword.trim()) p.set('q', f.keyword.trim())
  if (f.sort !== 'recommended') p.set('sort', f.sort)
  return p
}

/** 全角・半角、カタカナ・ひらがな、大文字・小文字の違いを気にせず探せるようにそろえる */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

function descriptionText(blocks: RichBlock[]): string {
  return blocks.map((b) => b.spans.map((s) => s.text).join('')).join(' ')
}

function matchesKeyword(p: Product, keyword: string, categories: Category[]): boolean {
  const words = normalizeText(keyword).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const catNames = categories.filter((c) => p.categoryIds.includes(c.id)).map((c) => c.name)
  const haystack = normalizeText([p.name, descriptionText(p.description), ...catNames].join(' '))
  return words.every((w) => haystack.includes(w))
}

export function applyFilters(products: Product[], f: Filters, categories: Category[] = []): Product[] {
  const band = PRICE_BANDS.find((b) => b.id === f.price)
  const result = products.filter((p) => {
    if (f.categoryId && !p.categoryIds.includes(f.categoryId)) return false
    if (f.inStockOnly && availabilityOf(p).kind !== 'in_stock') return false
    if (band && !(p.basePrice >= band.min && p.basePrice < band.max)) return false
    return matchesKeyword(p, f.keyword, categories)
  })
  const byNew = (a: Product, b: Product) => b.createdAtMs - a.createdAtMs
  const compare: Record<SortKey, (a: Product, b: Product) => number> = {
    recommended: (a, b) => a.sortOrder - b.sortOrder || byNew(a, b),
    new: byNew,
    price_asc: (a, b) => a.basePrice - b.basePrice || a.sortOrder - b.sortOrder,
    price_desc: (a, b) => b.basePrice - a.basePrice || a.sortOrder - b.sortOrder,
  }
  return result.sort(compare[f.sort])
}

/** 条件がいくつ付いているか（カテゴリと並び替えは数えない） */
export function activeFilterCount(f: Filters): number {
  return Number(f.inStockOnly) + Number(f.price !== null) + Number(f.keyword.trim() !== '')
}

/** カテゴリをまとまりごとに分ける（まとまりの順は、その中の一番小さい表示順） */
export function groupCategories(categories: Category[]): { group: string; items: Category[] }[] {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  const groups: { group: string; items: Category[] }[] = []
  for (const c of sorted) {
    const g = groups.find((x) => x.group === c.group)
    if (g) g.items.push(c)
    else groups.push({ group: c.group, items: [c] })
  }
  return groups
}
