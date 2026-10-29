import { PREFECTURES } from '@domain/prefectures.ts'
import type { ShippingTable } from '@domain/types.ts'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { yen } from '../../lib/format.ts'
import { AdminError } from '../AdminData.ts'
import { useAdmin } from '../AdminContext.tsx'
import { tmpId } from '../productForm.ts'
import { REGIONS, draftToTable, feeTexts, fillRegion, regionValue, type ShippingDraft } from '../shippingForm.ts'
import { ConfirmButton, Field } from '../ui.tsx'

function summary(t: ShippingTable): string {
  if (t.mode === 'flat') return `全国一律 ${t.flatFee !== undefined ? yen(t.flatFee) : '未設定'}`
  const fees = Object.values(t.fees ?? {}).filter((n): n is number => typeof n === 'number')
  if (fees.length === 0) return '都道府県ごと（未設定）'
  return `都道府県ごと ${yen(Math.min(...fees))}〜${yen(Math.max(...fees))}`
}

export function ShippingListPage() {
  const { data } = useAdmin()
  const [list, setList] = useState<ShippingTable[] | null>(null)
  useEffect(() => {
    data.listShippingTables().then(setList)
  }, [data])
  if (!list) return <p className="status">読み込み中…</p>
  return (
    <section>
      <div className="admin-page-head">
        <h1>送料表（{list.length}）</h1>
      </div>
      <p className="afield-hint">配送方法ごとに作ります（例：クリックポスト＝全国一律、ゆうパック60サイズ＝都道府県ごと）。商品ごとにどれを使うか選びます。</p>
      <Link to="/admin/shipping/new" className="add-button">＋ 送料表を追加</Link>
      <ul className="admin-list">
        {list.map((t) => (
          <li key={t.id} className="admin-item">
            <Link to={`/admin/shipping/${t.id}`} className="admin-item-row">
              <span className="admin-item-body">
                <span className="admin-item-name">{t.name}</span>
                <span className="admin-item-meta">{summary(t)}</span>
              </span>
              <span className="chevron" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ShippingEditPage() {
  const { id } = useParams()
  const { data, changed, toast } = useAdmin()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<ShippingDraft | null>(null)
  const [openRegion, setOpenRegion] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const tables = await data.listShippingTables()
      const t = id ? tables.find((x) => x.id === id) : undefined
      const base: ShippingTable = t ?? { id: tmpId('ship-'), name: '', mode: 'flat' }
      setDraft({ id: base.id, name: base.name, mode: base.mode, flat: base.flatFee !== undefined ? String(base.flatFee) : '', fees: feeTexts(base) })
    })()
  }, [data, id])

  if (!draft) return <p className="status">読み込み中…</p>
  const set = (patch: Partial<ShippingDraft>) => setDraft({ ...draft, ...patch })

  const save = async () => {
    const { table, error } = draftToTable(draft)
    setError(error ?? '')
    if (!table) return
    setSaving(true)
    try {
      await data.saveShippingTable(table)
      changed()
      toast('保存しました')
      navigate('/admin/shipping')
    } catch {
      toast('保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="product-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="admin-page-head">
        <Link to="/admin/shipping" className="back-button"><span aria-hidden="true">‹</span> 送料表</Link>
        <h1>{id ? '送料表を編集' : '送料表を追加'}</h1>
      </div>
      <section className="aform-section">
        <Field label="名前" hint="お客さんにも見えます（例：ゆうパック60サイズ）">
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="例：クリックポスト" />
        </Field>
        <div className="segmented">
          {(['flat', 'by_prefecture'] as const).map((m) => (
            <label key={m} className={draft.mode === m ? 'on' : ''}>
              <input type="radio" name="mode" checked={draft.mode === m} onChange={() => set({ mode: m })} />
              {m === 'flat' ? '全国一律' : '都道府県ごと'}
            </label>
          ))}
        </div>
        {draft.mode === 'flat' ? (
          <Field label="送料（円）">
            <input inputMode="numeric" value={draft.flat} onChange={(e) => set({ flat: e.target.value })} placeholder="例：185" />
          </Field>
        ) : (
          <div className="region-list">
            <p className="afield-hint">地方ごとにまとめて入れてから、違う県だけ「県ごとに直す」で直せます。</p>
            {REGIONS.map((r) => {
              const v = regionValue(draft.fees, r)
              const prefs = PREFECTURES.filter((p) => p.region === r)
              return (
                <div key={r} className="region-row">
                  <div className="region-head">
                    <span className="region-name">{r}</span>
                    <input
                      inputMode="numeric"
                      aria-label={`${r}の送料`}
                      value={v ?? ''}
                      placeholder={v === null ? 'ばらばら' : '円'}
                      onChange={(e) => set({ fees: fillRegion(draft.fees, r, e.target.value) })}
                    />
                    {prefs.length > 1 && (
                      <button type="button" className="link-button" aria-label={`${r}を県ごとに直す`} aria-expanded={openRegion === r} onClick={() => setOpenRegion(openRegion === r ? null : r)}>
                        {openRegion === r ? '閉じる' : '県ごとに直す'}
                      </button>
                    )}
                  </div>
                  {openRegion === r && (
                    <div className="pref-grid">
                      {prefs.map((p) => (
                        <label key={p.code}>
                          <span>{p.name}</span>
                          <input
                            inputMode="numeric"
                            aria-label={`${p.name}の送料`}
                            value={draft.fees[p.code]}
                            onChange={(e) => set({ fees: { ...draft.fees, [p.code]: e.target.value } })}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {error && <p className="afield-error has-error">{error}</p>}
      </section>

      {id && (
        <section className="aform-section">
          <h2>この送料表を消す</h2>
          <ConfirmButton
            label="送料表を消す"
            confirmLabel="消す"
            message={`「${draft.name}」を消します。使っている商品があるときは消せません。`}
            onConfirm={async () => {
              try {
                await data.deleteShippingTable(id)
                changed()
                toast('消しました')
                navigate('/admin/shipping')
              } catch (e) {
                toast(e instanceof AdminError ? e.message : '消せませんでした')
              }
            }}
          />
        </section>
      )}

      <div className="save-bar">
        <Link to="/admin/shipping" className="secondary-button">やめる</Link>
        <button type="submit" className="buy-button" disabled={saving}>
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </form>
  )
}
