import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { DATA_MODE, SHOP_NAME } from '../config.ts'
import { useShopData } from '../data/ShopDataContext.tsx'
import { resetSampleState } from '../data/sampleStore.ts'
import type { AdminData, AdminSession, SessionState } from './AdminData.ts'
import { AdminContext, type AdminCtx } from './AdminContext.tsx'
import './admin.css'
import { createAdmin } from './createAdmin.ts'
import { CategoriesPage } from './pages/CategoriesPage.tsx'
import { ProductEditPage } from './pages/ProductEditPage.tsx'
import { ProductsPage } from './pages/ProductsPage.tsx'
import { ShippingEditPage, ShippingListPage } from './pages/ShippingPages.tsx'
import { Toast } from './ui.tsx'

/** 管理画面（スマホ専用）。お姉ちゃんの Google アカウントだけが入れる */
export default function AdminApp() {
  const [admin, setAdmin] = useState<{ data: AdminData; session: AdminSession } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    createAdmin().then(setAdmin, (e) => {
      console.error(e)
      setFailed(true)
    })
  }, [])
  if (failed) return <p className="status">管理画面を開けませんでした。時間をおいて開き直してください。</p>
  if (!admin) return <p className="status">読み込み中…</p>
  return <Gate data={admin.data} session={admin.session} />
}

function Gate({ data, session }: { data: AdminData; session: AdminSession }) {
  const [state, setState] = useState<SessionState>(session.get())
  useEffect(() => session.subscribe(setState), [session])
  const shop = useShopData()
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const ctx: AdminCtx = useMemo(() => ({ data, session, changed: () => shop.refresh(), toast: setToast }), [data, session, shop])

  if (state.status === 'loading') return <p className="status">読み込み中…</p>
  if (state.status === 'signedOut') return <LoginPage session={session} />
  if (state.status === 'notAdmin') {
    return (
      <div className="admin-login">
        <h1>管理画面</h1>
        <p>このアカウント（{state.email}）は、管理画面に入れるように登録されていません。</p>
        <p className="afield-hint">登録するときに使う番号：<code>{state.uid}</code></p>
        <button type="button" className="secondary-button" onClick={() => session.signOut()}>
          別のアカウントでログインする
        </button>
      </div>
    )
  }

  return (
    <AdminContext.Provider value={ctx}>
      <div className="admin">
        <header className="admin-header">
          <span className="admin-title">管理画面</span>
          <Link to="/" className="admin-header-link">お店を見る</Link>
          <button type="button" className="admin-header-link" onClick={() => session.signOut()}>
            ログアウト
          </button>
        </header>
        {DATA_MODE === 'sample' && (
          <p className="dev-note admin-note">
            お試しの管理画面です。変えた内容はこの端末のブラウザの中だけに保存されます（写真は開き直すと消えます）。
            <button
              type="button"
              className="link-button"
              onClick={() => {
                resetSampleState()
                location.reload()
              }}
            >
              最初の状態に戻す
            </button>
          </p>
        )}
        <main className="admin-main">
          <Routes>
            <Route index element={<ProductsPage />} />
            <Route path="products/new" element={<ProductEditPage />} />
            <Route path="products/:id" element={<ProductEditPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="shipping" element={<ShippingListPage />} />
            <Route path="shipping/new" element={<ShippingEditPage />} />
            <Route path="shipping/:id" element={<ShippingEditPage />} />
          </Routes>
        </main>
        <nav className="admin-tabs" aria-label="管理画面のメニュー">
          <NavLink to="/admin" end>商品</NavLink>
          <NavLink to="/admin/categories">カテゴリ</NavLink>
          <NavLink to="/admin/shipping">送料表</NavLink>
        </nav>
        <Toast message={toast} onDone={clearToast} />
      </div>
    </AdminContext.Provider>
  )
}

function LoginPage({ session }: { session: AdminSession }) {
  const [error, setError] = useState('')
  return (
    <div className="admin-login">
      <h1>{SHOP_NAME}<br />管理画面</h1>
      <button
        type="button"
        className="buy-button"
        onClick={() => session.signIn().catch(() => setError('ログインできませんでした。もう一度お試しください。'))}
      >
        Google でログイン
      </button>
      {error && <p className="afield-error">{error}</p>}
      <Link to="/">お店にもどる</Link>
    </div>
  )
}
