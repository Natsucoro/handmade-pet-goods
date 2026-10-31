import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CHECKOUT_ENABLED } from '../config.ts'
import { cartCount, useCart } from '../lib/cart.ts'

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const HOME = 'M4 11 12 4l8 7M6 9.5V20h4.5v-5h3v5H18V9.5'
const SEARCH = 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20'
const CART = 'M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.3M9.5 19.5h.01M17 19.5h.01'
const ORDERS = 'M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1ZM9 8h6M9 12h6'

/** 画面の下にいつも出るメニュー（なつみの決定 2026年10月31日） */
export function BottomNav() {
  const { pathname } = useLocation()
  const n = cartCount(useCart())
  useTypingFlag()
  const on = (match: boolean) => (match ? 'bnav-item on' : 'bnav-item')
  return (
    <nav className="bottom-nav" aria-label="メニュー">
      <Link to="/" className={on(pathname === '/' || pathname.startsWith('/products/'))} aria-current={pathname === '/' ? 'page' : undefined}>
        <Icon d={HOME} />
        <span>ホーム</span>
      </Link>
      <Link to="/search" className={on(pathname === '/search')} aria-current={pathname === '/search' ? 'page' : undefined}>
        <Icon d={SEARCH} />
        <span>さがす</span>
      </Link>
      {CHECKOUT_ENABLED && (
        <>
          <Link
            to="/cart"
            className={on(pathname === '/cart' || pathname === '/checkout')}
            aria-current={pathname === '/cart' ? 'page' : undefined}
            aria-label={n > 0 ? `カート（${n}点）` : 'カート'}
          >
            <span className="bnav-icon">
              <Icon d={CART} />
              {n > 0 && <span key={n} className="cart-badge">{n}</span>}
            </span>
            <span>カート</span>
          </Link>
          <Link
            to="/orders"
            className={on(pathname.startsWith('/orders') || pathname.startsWith('/pay/'))}
            aria-current={pathname === '/orders' ? 'page' : undefined}
          >
            <Icon d={ORDERS} />
            <span>ご注文</span>
          </Link>
        </>
      )}
    </nav>
  )
}

/**
 * 文字を打っている間は、メニューを隠す（スマホのキーボードの上にメニューが乗って、入力欄が狭くならないように）
 */
function useTypingFlag() {
  useEffect(() => {
    const isText = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && !['radio', 'checkbox', 'button', 'submit', 'range', 'color', 'file'].includes(el.type)) ||
      (el instanceof HTMLElement && el.isContentEditable)
    let timer = 0
    const update = () => document.documentElement.classList.toggle('typing', isText(document.activeElement))
    // 入力欄に入ったときはすぐ隠す。ボタンなどに移ったときは、すぐには戻さない（下の onOut に任せる）
    const onIn = (e: FocusEvent) => {
      if (!isText(e.target)) return
      clearTimeout(timer)
      update()
    }
    // 入力欄からボタンを押したとき、メニューが先に戻ってボタンが動き、押し損ねないように、少し待ってから戻す
    const onOut = () => {
      clearTimeout(timer)
      timer = window.setTimeout(update, 400)
    }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      document.documentElement.classList.remove('typing')
    }
  }, [])
}
