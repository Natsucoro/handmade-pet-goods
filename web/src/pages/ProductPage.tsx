import type { Category, Product, ShippingTable } from '@domain/types.ts'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { assetUrl } from '../config.ts'
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
    const [table, categories] = await Promise.all([
      product ? data.getShippingTable(product.shippingTableId) : null,
      data.listCategories(),
    ])
    return { product, table, categories }
  }, [data, id])

  if (loaded.state === 'loading') return <p className="status">読み込み中…</p>
  if (loaded.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>
  const { product, table, categories } = loaded.value
  if (!product) {
    return (
      <div className="status">
        <p>この商品は見つかりませんでした。</p>
        <Link to="/" className="primary-small">商品一覧へ</Link>
      </div>
    )
  }
  return <ProductDetail product={product} table={table} categories={categories} />
}

/** 一覧から来たときは、ブラウザの「戻る」と同じ動き（同じ条件・同じ位置の一覧に戻る） */
function useBackToList() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { fromList?: boolean; listQuery?: string } | null
  return () => {
    if (state?.fromList) navigate(-1)
    else navigate(state?.listQuery ? `/?${state.listQuery}` : '/')
  }
}

function BackBar({ product, categories }: { product: Product; categories: Category[] }) {
  const back = useBackToList()
  const mainCategory = categories.find((c) => product.categoryIds.includes(c.id))
  return (
    <div className="back-bar">
      <button type="button" className="back-button" onClick={back}>
        <span aria-hidden="true">‹</span> 一覧にもどる
      </button>
      <nav className="breadcrumb" aria-label="現在の場所">
        <Link to="/">すべての商品</Link>
        {mainCategory && (
          <>
            <span aria-hidden="true"> › </span>
            <Link to={`/?cat=${encodeURIComponent(mainCategory.id)}`}>{mainCategory.name}</Link>
          </>
        )}
      </nav>
    </div>
  )
}

function ProductDetail({ product, table, categories }: { product: Product; table: ShippingTable | null; categories: Category[] }) {
  const back = useBackToList()
  const productCategories = categories.filter((c) => product.categoryIds.includes(c.id))
  useEffect(() => {
    trackViewItem(product)
  }, [product])
  const availability = availabilityOf(product)
  const choiceQuestions = product.questions.filter((q) => q.kind === 'choice' && q.choices?.length)

  return (
    <article className="product">
      <BackBar product={product} categories={categories} />
      <PhotoCarousel photos={product.photos} alt={product.name} />

      <div className="product-head">
        <h1>{product.name}</h1>
        <p className="product-price">{yen(product.basePrice)}</p>
        <AvailabilityBadge availability={availability} />
        {productCategories.length > 0 && (
          <ul className="tag-list" aria-label="カテゴリ">
            {productCategories.map((c) => (
              <li key={c.id}>
                <Link to={`/?cat=${encodeURIComponent(c.id)}`} className="chip small">{c.name}</Link>
              </li>
            ))}
          </ul>
        )}
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

      <RelatedProducts product={product} />

      <div className="page-end-nav">
        <button type="button" className="secondary-button" onClick={back}>
          <span aria-hidden="true">‹</span> 一覧にもどる
        </button>
      </div>

      <div className="buy-bar">
        <button type="button" className="buy-button" disabled>
          {availability.kind === 'sold_out' ? '売り切れ' : 'ご購入はもうすぐできるようになります'}
        </button>
      </div>
    </article>
  )
}

/** 同じカテゴリのほかの商品（最大4つ） */
function RelatedProducts({ product }: { product: Product }) {
  const data = useShopData()
  const location = useLocation()
  const listQuery = (location.state as { listQuery?: string } | null)?.listQuery ?? ''
  const list = useLoad(() => data.listProducts(), [data])
  if (list.state !== 'done') return null
  const related = list.value
    .filter((p) => p.id !== product.id && p.categoryIds.some((c) => product.categoryIds.includes(c)))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 4)
  if (related.length === 0) return null
  return (
    <section className="related" aria-labelledby="related-title">
      <h2 id="related-title">こちらもおすすめ</h2>
      <ul className="related-list">
        {related.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`} state={{ listQuery }}>
              {p.photos[0] ? <img src={assetUrl(p.photos[0].thumbUrl)} alt="" loading="lazy" /> : <span className="no-photo" />}
              <span className="related-name">{p.name}</span>
              <span className="related-price">{yen(p.basePrice)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
