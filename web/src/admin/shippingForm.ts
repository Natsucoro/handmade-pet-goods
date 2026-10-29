// 送料表の編集：地方ごとにまとめて入れてから、県ごとに直せる。
import { PREFECTURES, type PrefectureCode } from '@domain/prefectures.ts'
import type { ShippingTable } from '@domain/types.ts'
import { toInt } from './util.ts'

export const REGIONS = Array.from(new Set(PREFECTURES.map((p) => p.region)))

export type FeeTexts = Record<PrefectureCode, string>

export function feeTexts(t: ShippingTable): FeeTexts {
  return Object.fromEntries(PREFECTURES.map((p) => [p.code, t.fees?.[p.code] !== undefined ? String(t.fees[p.code]) : ''])) as FeeTexts
}

/** 地方の全部の県に同じ送料を入れる */
export function fillRegion(texts: FeeTexts, region: string, value: string): FeeTexts {
  const next = { ...texts }
  for (const p of PREFECTURES) if (p.region === region) next[p.code] = value
  return next
}

/** 地方の県がみんな同じ送料なら、その値。ばらばらなら null */
export function regionValue(texts: FeeTexts, region: string): string | null {
  const vals = new Set(PREFECTURES.filter((p) => p.region === region).map((p) => texts[p.code]))
  return vals.size === 1 ? [...vals][0] : null
}

export interface ShippingDraft { id: string; name: string; mode: 'flat' | 'by_prefecture'; flat: string; fees: FeeTexts }

export function draftToTable(d: ShippingDraft): { table?: ShippingTable; error?: string } {
  const name = d.name.trim()
  if (!name) return { error: '送料表の名前を入れてください' }
  if (d.mode === 'flat') {
    const fee = toInt(d.flat)
    if (fee === null || fee < 0) return { error: '送料を0以上の数字で入れてください' }
    return { table: { id: d.id, name, mode: 'flat', flatFee: fee } }
  }
  const fees: Partial<Record<PrefectureCode, number>> = {}
  const missing: string[] = []
  for (const p of PREFECTURES) {
    const t = d.fees[p.code].trim()
    if (t === '') {
      missing.push(p.name)
      continue
    }
    const v = toInt(t)
    if (v === null || v < 0) return { error: `${p.name}の送料を0以上の数字で入れてください` }
    fees[p.code] = v
  }
  if (missing.length) return { error: `送料が空の県があります（${missing.slice(0, 3).join('、')}${missing.length > 3 ? ` ほか${missing.length - 3}県` : ''}）。お届けしない県がなければ、全部入れてください` }
  return { table: { id: d.id, name, mode: 'by_prefecture', fees } }
}
