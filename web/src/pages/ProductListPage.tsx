import type { Category, Product } from '@domain/types.ts'
import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AvailabilityBadge } from '../components/AvailabilityBadge.tsx'
import { assetUrl } from '../config.ts'
import { useShopData } from '../data/ShopDataContext.tsx'
import { availabilityOf } from '../lib/availability.ts'
import {
  EMPTY_FILTERS,
  PRICE_BANDS,
  SORT_LABELS,
  activeFilterCount,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  groupCategories,
  type Filters,
  type SortKey,
} from '../lib/catalog.ts'
import { yen } from '../lib/format.ts'
import { useLoad } from '../lib/useLoad.ts'
import { FadeImg } from '../components/FadeImg.tsx'
import { ProductGridSkeleton } from '../components/Loading.tsx'

export function ProductListPage() {
  const data = useShopData()
  const loaded = useLoad(async () => {
    const [products, categories] = await Promise.all([data.listProducts(), data.listCategories()])
    return { products, categories }
  }, [data])
  const [params, setParams] = useSearchParams()
  const filters = filtersFromParams(params)
  // 条件を変えても「戻る」の履歴は増やさない（戻るで商品ページの前の画面に戻れるように）
  const update = (patch: Partial<Filters>) => setParams(filtersToParams({ ...filters, ...patch }), { replace: true })

  if (loaded.state === 'loading') return <ProductGridSkeleton />
  if (loaded.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>
  if (loaded.value.products.length === 0) return <p className="status">商品はまだありません。</p>

  return (
    <Catalog
      products={loaded.value.products}
      categories={loaded.value.categories}
      filters={filters}
      update={update}
      query={params.toString()}
    />
  )
}

function Catalog({
  products,
  categories,
  filters,
  update,
  query,
}: {
  products: Product[]
  categories: Category[]
  filters: Filters
  update: (patch: Partial<Filters>) => void
  query: string
}) {
  const shown = useMemo(() => applyFilters(products, filters, categories), [products, filters, categories])
  const groups = groupCategories(categories.filter((c) => products.some((p) => p.categoryIds.includes(c.id))))
  const extra = activeFilterCount(filters)
  const [panelOpen, setPanelOpen] = useState(false)
  const panelId = useId()
  const currentCategory = categories.find((c) => c.id === filters.categoryId)

  return (
    <div className="catalog">
      <SearchBox value={filters.keyword} onChange={(keyword) => update({ keyword })} />

      {groups.length > 0 && (
        <nav className="category-nav" aria-label="カテゴリ">
          <div className="chip-row">
            <button
              type="button"
              className={filters.categoryId === null ? 'chip active' : 'chip'}
              aria-pressed={filters.categoryId === null}
              onClick={() => update({ categoryId: null })}
            >
              すべて
            </button>
          </div>
          {groups.map((g) => (
            <div className="chip-row" key={g.group} role="group" aria-label={g.group || 'カテゴリ'}>
              {g.group && <span className="chip-row-label">{g.group}</span>}
              {g.items.map((c) => {
                const active = filters.categoryId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={active ? 'chip active' : 'chip'}
                    aria-pressed={active}
                    onClick={() => update({ categoryId: active ? null : c.id })}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      )}

      <div className="toolbar">
        <p className="result-count" aria-live="polite">
          {currentCategory ? `${currentCategory.name}：` : ''}
          <strong>{shown.length}</strong>件
        </p>
        <button
          type="button"
          className={extra > 0 ? 'tool-button active' : 'tool-button'}
          aria-expanded={panelOpen}
          aria-controls={panelId}
          onClick={() => setPanelOpen((o) => !o)}
        >
          絞り込み{extra > 0 ? `（${extra}）` : ''}
        </button>
        <label className="sort-select">
          <span className="visually-hidden">並び替え</span>
          <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {panelOpen && (
        <section className="filter-panel" id={panelId} aria-label="絞り込み">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={filters.inStockOnly}
              onChange={(e) => update({ inStockOnly: e.target.checked })}
            />
            <span>すぐ届くもの（在庫あり）だけ</span>
          </label>
          <fieldset className="price-bands">
            <legend>値段</legend>
            <div className="chip-row wrap">
              <button
                type="button"
                className={filters.price === null ? 'chip active' : 'chip'}
                aria-pressed={filters.price === null}
                onClick={() => update({ price: null })}
              >
                指定なし
              </button>
              {PRICE_BANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={filters.price === b.id ? 'chip active' : 'chip'}
                  aria-pressed={filters.price === b.id}
                  onClick={() => update({ price: filters.price === b.id ? null : b.id })}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="panel-actions">
            <button type="button" className="link-button" onClick={() => update({ ...EMPTY_FILTERS, sort: filters.sort, categoryId: filters.categoryId })}>
              条件をクリア
            </button>
            <button type="button" className="primary-small" onClick={() => setPanelOpen(false)}>
              {shown.length}件を見る
            </button>
          </div>
        </section>
      )}

      {shown.length === 0 ? (
        <div className="status">
          <p>条件に合う商品がありません。</p>
          <button type="button" className="primary-small" onClick={() => update({ ...EMPTY_FILTERS })}>
            すべての商品を見る
          </button>
        </div>
      ) : (
        <ul className="product-grid">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} fromQuery={query} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ProductCard({ product: p, fromQuery }: { product: Product; fromQuery: string }) {
  const cover = p.photos[0]
  const availability = availabilityOf(p)
  return (
    <li className={availability.kind === 'sold_out' ? 'card soldout' : 'card'}>
      {/* 一覧から来たことを覚えておき、商品ページの「戻る」で同じ条件の一覧に戻す */}
      <Link to={`/products/${p.id}`} state={{ fromList: true, listQuery: fromQuery }}>
        <div className="card-photo">
          {cover ? <FadeImg src={assetUrl(cover.thumbUrl)} alt="" loading="lazy" /> : <span>写真なし</span>}
        </div>
        <div className="card-body">
          <h2 className="card-name">{p.name}</h2>
          <p className="card-price">{yen(p.basePrice)}</p>
          <AvailabilityBadge availability={availability} />
        </div>
      </Link>
    </li>
  )
}

/** 打つたびに一覧が変わると重いので、打ち終わって少し待ってから反映する */
function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  useEffect(() => {
    if (text === value) return
    const t = setTimeout(() => onChange(text), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); onChange(text); (document.activeElement as HTMLElement | null)?.blur() }}>
      <label className="visually-hidden" htmlFor="search-input">商品をさがす</label>
      <input
        id="search-input"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        placeholder="商品をさがす（例：つぼ巣）"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text && (
        <button type="button" className="search-clear" aria-label="検索の文字を消す" onClick={() => { setText(''); onChange('') }}>
          ×
        </button>
      )}
    </form>
  )
}
