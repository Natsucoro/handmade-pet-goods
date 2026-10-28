import { Link } from 'react-router-dom'
import { assetUrl } from '../config.ts'
import { AvailabilityBadge } from '../components/AvailabilityBadge.tsx'
import { useShopData } from '../data/ShopDataContext.tsx'
import { availabilityOf } from '../lib/availability.ts'
import { yen } from '../lib/format.ts'
import { useLoad } from '../lib/useLoad.ts'

export function ProductListPage() {
  const data = useShopData()
  const products = useLoad(() => data.listProducts(), [data])

  if (products.state === 'loading') return <p className="status">読み込み中…</p>
  if (products.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>
  if (products.value.length === 0) return <p className="status">商品はまだありません。</p>

  return (
    <ul className="product-grid">
      {products.value.map((p) => {
        const cover = p.photos[0]
        const availability = availabilityOf(p)
        return (
          <li key={p.id} className={availability.kind === 'sold_out' ? 'card soldout' : 'card'}>
            <Link to={`/products/${p.id}`}>
              <div className="card-photo">
                {cover ? <img src={assetUrl(cover.thumbUrl)} alt="" loading="lazy" /> : <span>写真なし</span>}
              </div>
              <div className="card-body">
                <h2 className="card-name">{p.name}</h2>
                <p className="card-price">{yen(p.basePrice)}</p>
                <AvailabilityBadge availability={availability} />
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
