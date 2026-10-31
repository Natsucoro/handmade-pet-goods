import { MAX_QUANTITY, maxQuantity } from '@domain/checkout.ts'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FadeImg } from '../../components/FadeImg.tsx'
import { ListSkeleton } from '../../components/Loading.tsx'
import { assetUrl } from '../../config.ts'
import { removeLine, setLineQuantity, useCart } from '../../lib/cart.ts'
import { yen } from '../../lib/format.ts'
import { useCartDetails, type CartRow } from './useCartDetails.ts'

export function CartPage() {
  const lines = useCart()
  const details = useCartDetails(lines)
  const navigate = useNavigate()

  if (lines.length === 0) {
    return (
      <div className="checkout">
        <h1 className="page-title">カート</h1>
        <div className="status">
          <p>カートは空です。</p>
          <Link to="/" className="primary-small">商品を見る</Link>
        </div>
      </div>
    )
  }
  if (details.state === 'loading') return <ListSkeleton rows={lines.length} />
  if (details.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>

  return (
    <div className="checkout">
      <h1 className="page-title">カート</h1>
      <ul className="cart-list">
        {details.rows.map((r) => (
          <CartItem key={r.line.key} row={r} rows={details.rows} />
        ))}
      </ul>
      <section className="panel">
        <h2>お会計の目安</h2>
        <dl className="totals">
          <div className="grand only"><dt>商品代</dt><dd>{yen(details.subtotal)}</dd></div>
        </dl>
        <p className="ofield-hint">送料は、次の画面でお届け先を選ぶと出ます。同じ配送方法の商品は、送料1回分にまとめます。</p>
      </section>
      <div className="page-end-nav">
        <Link to="/" className="secondary-button">
          <span aria-hidden="true">‹</span> 買い物を続ける
        </Link>
      </div>
      <div className="buy-bar">
        <button type="button" className="buy-button" disabled={!details.ok} onClick={() => navigate('/checkout')}>
          {details.ok ? '購入手続きへ' : '赤い印の商品を直してください'}
        </button>
      </div>
    </div>
  )
}

function CartItem({ row, rows }: { row: CartRow; rows: CartRow[] }) {
  const [confirming, setConfirming] = useState(false)
  const { line, product, item, problem } = row
  const max = product ? maxQuantity(product) : null
  const others = rows.filter((r) => r !== row && r.line.productId === line.productId).reduce((n, r) => n + r.line.quantity, 0)
  const limit = Math.min(MAX_QUANTITY, max === null ? MAX_QUANTITY : Math.max(1, max - others))
  const photo = product?.photos[0]
  const name = product?.name ?? '（いまは買えない商品）'
  return (
    <li className={problem ? 'cart-item has-problem' : 'cart-item'}>
      <div className="cart-main">
        <Link to={`/products/${encodeURIComponent(line.productId)}`} className="cart-photo" aria-label={name}>
          {photo ? <FadeImg src={assetUrl(photo.thumbUrl)} alt="" /> : <span />}
        </Link>
        <div className="cart-body">
          <p className="cart-name">{name}</p>
          {item && item.answers.length > 0 && (
            <ul className="cart-answers">
              {item.answers.map((a) => (
                <li key={a.questionId}>{a.label}：{a.answer}</li>
              ))}
            </ul>
          )}
          {item && <p className="cart-price">{yen(item.unitPrice)} × {line.quantity} = <strong>{yen(item.unitPrice * line.quantity)}</strong></p>}
        </div>
      </div>
      {problem && <p className="oerror">{problem}</p>}
      <div className="cart-actions">
        <div className="stepper">
          <button type="button" aria-label={`${name}を1つ減らす`} disabled={line.quantity <= 1} onClick={() => setLineQuantity(line.key, line.quantity - 1)}>−</button>
          <output aria-label={`${name}の個数`}>{line.quantity}</output>
          <button type="button" aria-label={`${name}を1つ増やす`} disabled={line.quantity >= limit} onClick={() => setLineQuantity(line.key, line.quantity + 1)}>＋</button>
        </div>
        {confirming ? (
          <span className="cart-confirm">
            <button type="button" className="link-button" onClick={() => setConfirming(false)}>やめる</button>
            <button type="button" className="danger-small" onClick={() => removeLine(line.key)}>削除する</button>
          </span>
        ) : (
          <button type="button" className="link-button" aria-label={`${name}をカートから削除`} onClick={() => setConfirming(true)}>削除</button>
        )}
      </div>
    </li>
  )
}
