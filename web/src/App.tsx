import { lazy, Suspense, useEffect, useRef } from 'react'
import { Link, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { DATA_MODE } from './config.ts'
import { CheckoutPage } from './pages/order/CheckoutPage.tsx'
import { CartPage } from './pages/order/CartPage.tsx'
import { BottomNav } from './components/BottomNav.tsx'
import { SearchPage } from './pages/SearchPage.tsx'
import { SampleSwitch } from './components/SampleSwitch.tsx'
import { PayPage } from './pages/order/PayPage.tsx'
import { MyOrdersPage, OrderStatusPage } from './pages/order/OrderStatusPage.tsx'
import { useShopName } from './lib/useShopName.ts'
import { trackPageView } from './lib/analytics.ts'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { ProductListPage } from './pages/ProductListPage.tsx'
import { ProductPage } from './pages/ProductPage.tsx'
import { BirdLoader } from './components/Loading.tsx'

// 管理画面は、開いたときだけ読み込む（お客さんの画面を重くしない）
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'))

// ページごとのスクロール位置。「戻る」で一覧に戻ったとき、見ていた位置に戻すため
const scrollPositions = new Map<string, number>()

function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    const key = location.key
    const save = () => scrollPositions.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [location.key])

  useEffect(() => {
    const pathChanged = lastPath.current !== location.pathname
    lastPath.current = location.pathname
    // 管理画面はアクセス解析に数えない
    if (pathChanged && !location.pathname.startsWith('/admin')) trackPageView(location.pathname)
    const saved = scrollPositions.get(location.key)
    if (navigationType === 'POP' && saved !== undefined) {
      // 一覧が描き終わるのを少し待ってから戻す
      let tries = 0
      const restore = () => {
        window.scrollTo(0, saved)
        if (Math.abs(window.scrollY - saved) > 2 && tries++ < 30) requestAnimationFrame(restore)
      }
      requestAnimationFrame(restore)
    } else if (pathChanged) {
      window.scrollTo(0, 0)
    }
  }, [location.key, location.pathname, navigationType])
  return null
}

function Shop() {
  const shopName = useShopName()
  const { pathname } = useLocation()
  return (
    <div className="app">
      <header className="site-header">
        <Link to="/" className="site-title" aria-label={shopName || 'トップへ'}>
          {shopName ? <span className="shop-name">{shopName}</span> : <span className="sk sk-title" aria-hidden="true" />}
        </Link>
      </header>
      {DATA_MODE !== 'hosting' && (
        <div className="dev-note">
          <span>お試し表示です（にせの商品データ）。</span>
          {DATA_MODE === 'sample' && <SampleSwitch />}
        </div>
      )}
      <main>
        {/* ページが変わるたびに、ふわっと下から出す */}
        <div key={pathname} className="page-enter">
          <Routes>
            <Route path="/" element={<ProductListPage />} />
            <Route path="/products/:id" element={<ProductPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/pay/:id" element={<PayPage />} />
            <Route path="/orders" element={<MyOrdersPage />} />
            <Route path="/orders/:id" element={<OrderStatusPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </main>
      <footer className="site-footer">© {shopName}</footer>
      <BottomNav />
    </div>
  )
}

export function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<BirdLoader />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<Shop />} />
      </Routes>
    </>
  )
}
