import { PREFECTURES, type PrefectureCode } from '@domain/prefectures.ts'
import { shippingFee } from '@domain/pricing.ts'
import type { ShippingTable } from '@domain/types.ts'
import { useState } from 'react'
import { yen } from '../lib/format.ts'

/** 送料。全国一律ならその金額、都道府県ごとならお届け先を選ぶと金額が出る */
export function ShippingInfo({ table }: { table: ShippingTable }) {
  const [pref, setPref] = useState<PrefectureCode | ''>('')

  if (table.mode === 'flat') {
    return (
      <p className="shipping-line">
        全国一律 <strong>{table.flatFee !== undefined ? yen(table.flatFee) : '未設定'}</strong>
      </p>
    )
  }

  const fees = Object.values(table.fees ?? {}).filter((n): n is number => typeof n === 'number')
  const min = fees.length ? Math.min(...fees) : null
  const max = fees.length ? Math.max(...fees) : null
  const fee = pref ? shippingFee(table, pref) : null

  return (
    <div>
      {min !== null && max !== null && (
        <p className="shipping-line">
          {min === max ? yen(min) : `${yen(min)}〜${yen(max)}`}（お届け先で変わります）
        </p>
      )}
      <label className="field">
        <span>お届け先の都道府県</span>
        <select value={pref} onChange={(e) => setPref(e.target.value as PrefectureCode | '')}>
          <option value="">選んでください</option>
          {PREFECTURES.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
      </label>
      {pref && (
        <p className="shipping-result" aria-live="polite">
          送料 <strong>{fee === null ? 'この地域にはお届けできません' : yen(fee)}</strong>
        </p>
      )}
    </div>
  )
}
