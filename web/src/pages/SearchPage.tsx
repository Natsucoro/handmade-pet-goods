import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListSkeleton } from '../components/Loading.tsx'
import { useShopData } from '../data/ShopDataContext.tsx'
import { groupCategories } from '../lib/catalog.ts'
import { useLoad } from '../lib/useLoad.ts'

/** メニューの「さがす」：キーワードとカテゴリから探す */
export function SearchPage() {
  const data = useShopData()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const loaded = useLoad(async () => {
    const [products, categories] = await Promise.all([data.listProducts(), data.listCategories()])
    // 商品が1つもないカテゴリは出さない
    return groupCategories(categories.filter((c) => products.some((p) => p.categoryIds.includes(c.id))))
  }, [data])

  return (
    <div className="search-page">
      <h1 className="page-title">さがす</h1>
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          const q = text.trim()
          navigate(q ? `/?q=${encodeURIComponent(q)}` : '/')
        }}
      >
        <label className="visually-hidden" htmlFor="search-page-input">キーワード</label>
        <input
          id="search-page-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="キーワード（例：つぼ巣）"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </form>
      {loaded.state === 'loading' && <ListSkeleton rows={3} />}
      {loaded.state === 'done' &&
        loaded.value.map((g) => (
          <section key={g.group} className="search-group">
            <h2>{g.group || 'カテゴリ'}</h2>
            <ul className="search-cats">
              {g.items.map((c) => (
                <li key={c.id}>
                  <Link to={`/?cat=${encodeURIComponent(c.id)}`}>
                    <span>{c.name}</span>
                    <span className="chevron" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      <Link to="/" className="search-all">すべての商品を見る</Link>
    </div>
  )
}
