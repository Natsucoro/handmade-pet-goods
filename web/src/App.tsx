import { useEffect, useRef } from 'react'
import { Link, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { DATA_MODE, SHOP_NAME } from './config.ts'
import { trackPageView } from './lib/analytics.ts'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { ProductListPage } from './pages/ProductListPage.tsx'
import { ProductPage } from './pages/ProductPage.tsx'

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
    if (pathChanged) trackPageView(location.pathname)
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

export function App() {
  return (
    <div className="app">
      <ScrollManager />
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
