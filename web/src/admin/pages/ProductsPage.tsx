import type { Product } from '@domain/types.ts'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvailabilityBadge } from '../../components/AvailabilityBadge.tsx'
import { assetUrl } from '../../config.ts'
import { availabilityOf } from '../../lib/availability.ts'
import { yen } from '../../lib/format.ts'
import { useAdmin } from '../AdminContext.tsx'
import { MoveButtons } from '../ui.tsx'
import { move } from '../util.ts'

export function ProductsPage() {
  const { data, changed, toast } = useAdmin()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    data.listProducts().then(setProducts, () => setError(true))
  }, [data])

  if (error) return <p className="status">読み込めませんでした。開き直してください。</p>
  if (!products) return <p className="status">読み込み中…</p>

  const saveOrder = async () => {
    setSaving(true)
    try {
      await data.saveProductOrder(products.map((p) => p.id))
      changed()
      toast('並び順を保存しました')
      setSorting(false)
    } catch {
      toast('保存できませんでした。もう一度お試しください')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className="admin-page-head">
        <h1>商品（{products.length}）</h1>
        {!sorting && products.length > 1 && (
          <button type="button" className="secondary-button small" onClick={() => setSorting(true)}>
            並べ替え
          </button>
        )}
      </div>

      {sorting ? (
        <p className="afield-hint">上にあるほど、お店の一覧の「おすすめ順」で先に出ます。▲▼で動かして「並び順を保存」を押してください。</p>
      ) : (
        <Link to="/admin/products/new" className="add-button">
          ＋ 商品を追加
        </Link>
      )}

      {products.length === 0 && <p className="status">まだ商品がありません。「＋ 商品を追加」から登録してください。</p>}

      <ul className="admin-list">
        {products.map((p, i) => {
          const body = (
            <>
              <span className="admin-thumb">
                {p.photos[0] ? <img src={assetUrl(p.photos[0].thumbUrl)} alt="" /> : <span>写真なし</span>}
              </span>
              <span className="admin-item-body">
                <span className="admin-item-name">{p.name}</span>
                <span className="admin-item-meta">
                  {yen(p.basePrice)}
                  {!p.published && <span className="badge badge-soldout">非公開</span>}
                </span>
                <AvailabilityBadge availability={availabilityOf(p)} />
              </span>
            </>
          )
          return (
            <li key={p.id} className="admin-item">
              {sorting ? (
                <div className="admin-item-row">
                  {body}
                  <MoveButtons index={i} count={products.length} name={p.name} onMove={(a, b) => setProducts(move(products, a, b))} />
                </div>
              ) : (
                <Link to={`/admin/products/${p.id}`} className="admin-item-row">
                  {body}
                  <span className="chevron" aria-hidden="true">›</span>
                </Link>
              )}
            </li>
          )
        })}
      </ul>

      {sorting && (
        <div className="save-bar">
          <button
            type="button"
            className="secondary-button"
            disabled={saving}
            onClick={() => {
              setSorting(false)
              data.listProducts().then(setProducts)
            }}
          >
            やめる
          </button>
          <button type="button" className="buy-button" disabled={saving} onClick={saveOrder}>
            {saving ? '保存中…' : '並び順を保存'}
          </button>
        </div>
      )}
    </section>
  )
}
