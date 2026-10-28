import type { Product } from '@domain/types.ts'
import { LOW_STOCK } from '../config.ts'

export type Availability =
  | { kind: 'in_stock'; remaining: number | null; leadDays: number }
  | { kind: 'made_to_order'; leadDays: number }
  | { kind: 'sold_out' }

/** 在庫の種類と数から、お客さんに見せる状態を決める */
export function availabilityOf(p: Pick<Product, 'stockType' | 'stock' | 'whenSoldOut' | 'leadDays'>): Availability {
  if (p.stockType === 'made_to_order') return { kind: 'made_to_order', leadDays: p.leadDays }
  if (p.stock > 0) {
    return { kind: 'in_stock', remaining: p.stock <= LOW_STOCK ? p.stock : null, leadDays: p.leadDays }
  }
  return p.whenSoldOut === 'made_to_order' ? { kind: 'made_to_order', leadDays: p.leadDays } : { kind: 'sold_out' }
}

/** 一覧や商品ページに出す短い文 */
export function availabilityLabel(a: Availability): string {
  switch (a.kind) {
    case 'in_stock':
      return a.remaining === null ? '在庫あり' : `残り${a.remaining}個`
    case 'made_to_order':
      return `受注生産（約${a.leadDays}日でお届け）`
    case 'sold_out':
      return '売り切れ'
  }
}
