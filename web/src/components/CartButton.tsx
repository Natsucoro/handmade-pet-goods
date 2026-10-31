import { Link, useLocation } from 'react-router-dom'
import { cartCount, useCart } from '../lib/cart.ts'

/** 画面の上のカートのボタン（入っている数つき） */
export function CartButton() {
  const n = cartCount(useCart())
  const { pathname } = useLocation()
  return (
    <Link to="/cart" className={pathname === '/cart' ? 'cart-button on' : 'cart-button'} aria-label={n > 0 ? `カート（${n}点）` : 'カート'}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9.5" cy="19.5" r="1.5" fill="currentColor" />
        <circle cx="17" cy="19.5" r="1.5" fill="currentColor" />
      </svg>
      {n > 0 && <span key={n} className="cart-badge">{n}</span>}
    </Link>
  )
}
