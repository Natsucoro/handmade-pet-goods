import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { DATA_MODE, SHOP_NAME } from './config.ts'
import { trackPageView } from './lib/analytics.ts'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { ProductListPage } from './pages/ProductListPage.tsx'
import { ProductPage } from './pages/ProductPage.tsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    trackPageView(pathname)
  }, [pathname])
  return null
}

export function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <header className="site-header">
        <Link to="/" className="site-title">{SHOP_NAME}</Link>
      </header>
      {DATA_MODE !== 'hosting' && (
        <p className="dev-note">お試し表示です（にせの商品データ）。</p>
      )}
      <main>
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="site-footer">© {SHOP_NAME}</footer>
    </div>
  )
}
