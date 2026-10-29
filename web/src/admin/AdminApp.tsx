import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { DATA_MODE } from '../config.ts'
import { useShopName } from '../lib/useShopName.ts'
import { useShopData } from '../data/ShopDataContext.tsx'
import { resetSampleState } from '../data/sampleStore.ts'
import type { AdminData, AdminSession, SessionState } from './AdminData.ts'
import { AdminContext, type AdminCtx } from './AdminContext.tsx'
import './admin.css'
import { createAdmin } from './createAdmin.ts'
import { CategoriesPage } from './pages/CategoriesPage.tsx'
import { ProductEditPage } from './pages/ProductEditPage.tsx'
import { OrderDetailPage, OrdersPage } from './pages/OrdersPage.tsx'
import { ProductsPage } from './pages/ProductsPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
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
  const navigate = useNavigate()
  const dirty = useRef(false)
  const [pending, setPending] = useState<string | null>(null)
  const leave = useCallback(
    (to: string) => {
      if (dirty.current) setPending(to)
      else navigate(to)
    },
    [navigate],
  )
  const ctx: AdminCtx = useMemo(
    () => ({
      data,
      session,
      changed: () => shop.refresh(),
      toast: setToast,
      setDirty: (d: boolean) => {
        dirty.current = d
      },
      leave,
    }),
    [data, session, shop, leave],
  )
  // リンクを押したとき、保存していない変更があれば止めて確かめる
  const guard = (to: string) => (e: MouseEvent) => {
    if (!dirty.current) return
    e.preventDefault()
    setPending(to)
  }

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
          <Link to="/" className="admin-header-link" onClick={guard('/')}>お店を見る</Link>
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
            <Route index element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductEditPage />} />
            <Route path="products/:id" element={<ProductEditPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="shipping" element={<ShippingListPage />} />
            <Route path="shipping/new" element={<ShippingEditPage />} />
            <Route path="shipping/:id" element={<ShippingEditPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <nav className="admin-tabs" aria-label="管理画面のメニュー">
          <NavLink to="/admin" end onClick={guard('/admin')}>注文</NavLink>
          <NavLink to="/admin/products" onClick={guard('/admin/products')}>商品</NavLink>
          <NavLink to="/admin/categories" onClick={guard('/admin/categories')}>カテゴリ</NavLink>
          <NavLink to="/admin/shipping" onClick={guard('/admin/shipping')}>送料表</NavLink>
          <NavLink to="/admin/settings" onClick={guard('/admin/settings')}>設定</NavLink>
        </nav>
        <Toast message={toast} onDone={clearToast} />
        {pending && (
          <div className="modal-back" role="presentation">
            <div className="modal" role="alertdialog" aria-modal="true" aria-label="保存していない変更があります">
              <p className="modal-title">保存していない変更があります</p>
              <p>このまま移ると、変更は消えます。</p>
              <div className="confirm-actions">
                <button type="button" className="secondary-button" onClick={() => setPending(null)}>
                  編集にもどる
                </button>
                <button
                  type="button"
                  className="danger-button solid"
                  onClick={() => {
                    const to = pending
                    dirty.current = false
                    setPending(null)
                    navigate(to)
                  }}
                >
                  変更を捨てて移る
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminContext.Provider>
  )
}

function LoginPage({ session }: { session: AdminSession }) {
  const [error, setError] = useState('')
  const shopName = useShopName()
  return (
    <div className="admin-login">
      <h1>{shopName}<br />管理画面</h1>
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
