import { PREFECTURES } from '@domain/prefectures.ts'
import { shippingFee } from '@domain/pricing.ts'
import type { ShippingTable } from '@domain/types.ts'
import { yen } from '../lib/format.ts'

/**
 * 送料の目安。都道府県を選ぶ必要はない（送料はご注文のとき、お届け先に合わせて決まる）。
 * 都道府県ごとの送料表は、地方ごとの一覧を開いて見られる。
 */
export function ShippingInfo({ table }: { table: ShippingTable }) {
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
  const regions = [...new Set(PREFECTURES.map((p) => p.region))].map((region) => {
    const prefs = PREFECTURES.filter((p) => p.region === region).map((p) => ({ name: p.name, fee: shippingFee(table, p.code) }))
    const same = prefs.every((p) => p.fee === prefs[0].fee)
    return { region, prefs, same }
  })
  const label = (fee: number | null) => (fee === null ? 'お届けできません' : yen(fee))

  return (
    <div>
      {min !== null && max !== null && (
        <p className="shipping-line">
          <strong>{min === max ? yen(min) : `${yen(min)}〜${yen(max)}`}</strong>（お届け先で変わります）
        </p>
      )}
      <p className="ofield-hint">ご注文のときに、お届け先に合わせて送料が決まります。</p>
      <details className="fee-table">
        <summary>地域ごとの送料を見る</summary>
        <dl>
          {regions.map((r) =>
            r.same ? (
              <div key={r.region}>
                <dt>{r.region}</dt>
                <dd>{label(r.prefs[0].fee)}</dd>
              </div>
            ) : (
              r.prefs.map((p) => (
                <div key={p.name}>
                  <dt>{p.name}</dt>
                  <dd>{label(p.fee)}</dd>
                </div>
              ))
            ),
          )}
        </dl>
      </details>
    </div>
  )
}
