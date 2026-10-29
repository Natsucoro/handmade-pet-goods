import type { Product, ShippingTable } from '@domain/types.ts'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AvailabilityBadge } from '../components/AvailabilityBadge.tsx'
import { PhotoCarousel } from '../components/PhotoCarousel.tsx'
import { RichText } from '../components/RichText.tsx'
import { ShippingInfo } from '../components/ShippingInfo.tsx'
import { useShopData } from '../data/ShopDataContext.tsx'
import { availabilityOf } from '../lib/availability.ts'
import { extraYen, yen } from '../lib/format.ts'
import { trackViewItem } from '../lib/analytics.ts'
import { useLoad } from '../lib/useLoad.ts'

export function ProductPage() {
  const { id = '' } = useParams()
  const data = useShopData()
  const loaded = useLoad(async () => {
    const product = await data.getProduct(id)
    const table = product ? await data.getShippingTable(product.shippingTableId) : null
    return { product, table }
  }, [data, id])

  if (loaded.state === 'loading') return <p className="status">読み込み中…</p>
  if (loaded.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>
  const { product, table } = loaded.value
  if (!product) {
    return (
      <div className="status">
        <p>この商品は見つかりませんでした。</p>
        <Link to="/">商品一覧へ</Link>
      </div>
    )
  }
  return <ProductDetail product={product} table={table} />
}

function ProductDetail({ product, table }: { product: Product; table: ShippingTable | null }) {
  useEffect(() => {
    trackViewItem(product)
  }, [product])
  const availability = availabilityOf(product)
  const choiceQuestions = product.questions.filter((q) => q.kind === 'choice' && q.choices?.length)

  return (
    <article className="product">
      <PhotoCarousel photos={product.photos} alt={product.name} />

      <div className="product-head">
        <h1>{product.name}</h1>
        <p className="product-price">{yen(product.basePrice)}</p>
        <AvailabilityBadge availability={availability} />
      </div>

      <section className="panel">
        <h2>お届けの目安</h2>
        <p>
          {availability.kind === 'sold_out'
            ? '売り切れのため、いまはご注文いただけません。'
            : availability.kind === 'made_to_order'
              ? `ご注文を受けてから作ります。約${availability.leadDays}日でお届けします。`
              : `ご注文から約${availability.leadDays}日でお届けします。`}
        </p>
      </section>

      {choiceQuestions.length > 0 && (
        <section className="panel">
          <h2>選べる内容と値段</h2>
          <dl className="choices">
            {choiceQuestions.map((q) => (
              <div key={q.id}>
                <dt>
                  {q.label}
                  {q.required && <span className="required">必須</span>}
                </dt>
                <dd>
                  <ul>
                    {q.choices!.map((c) => (
                      <li key={c.id}>
                        {c.label}
                        {c.extraPrice !== 0 && <span className="extra">{extraYen(c.extraPrice)}</span>}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {product.description.length > 0 && (
        <section className="panel">
          <h2>商品の説明</h2>
          <RichText blocks={product.description} />
        </section>
      )}

      <section className="panel">
        <h2>送料</h2>
        {table ? <ShippingInfo table={table} /> : <p>送料はお問い合わせください。</p>}
      </section>

      <div className="buy-bar">
        <button type="button" className="buy-button" disabled>
          {availability.kind === 'sold_out' ? '売り切れ' : 'ご購入はもうすぐできるようになります'}
        </button>
      </div>
    </article>
  )
}
