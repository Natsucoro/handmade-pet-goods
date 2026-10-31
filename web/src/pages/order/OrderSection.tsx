import { MAX_QUANTITY, maxQuantity } from '@domain/checkout.ts'
import { unitPrice } from '@domain/pricing.ts'
import type { Product } from '@domain/types.ts'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { extraYen, yen } from '../../lib/format.ts'

import { addToCart, cartCount, useCart } from '../../lib/cart.ts'

/** 商品ページの「ご注文」：選ぶ内容と個数を決めて、カートに入れる */
export function OrderSection({ product }: { product: Product }) {
  const cart = useCart()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)
  const max = maxQuantity(product)
  // 在庫のある商品は、カートにもう入っている分を引いた数まで
  const inCart = cart.filter((l) => l.productId === product.id).reduce((n, l) => n + l.quantity, 0)
  const left = max === null ? MAX_QUANTITY : Math.max(0, max - inCart)
  const limit = Math.min(left, MAX_QUANTITY)
  const choiceAnswers = Object.fromEntries(product.questions.filter((q) => q.kind === 'choice' && answers[q.id]).map((q) => [q.id, answers[q.id]]))
  let price: number | null = null
  try {
    price = unitPrice(product, choiceAnswers)
  } catch {
    price = null
  }

  const add = () => {
    const missing = product.questions.find((q) => q.required && !(answers[q.id] ?? '').trim())
    if (missing) {
      setError(`「${missing.label}」を${missing.kind === 'choice' ? '選んで' : '入れて'}ください`)
      document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (limit < 1) {
      setError('在庫の分は、もうすべてカートに入っています')
      return
    }
    const r = addToCart(product.id, answers, Math.min(quantity, limit))
    if (r === 'full') {
      setError('カートがいっぱいです（20種類まで）。先にご注文をお済ませください')
      return
    }
    setError('')
    setAdded(true)
    setQuantity(1)
  }

  return (
    <>
      <section className="panel order-panel" id="order" aria-labelledby="order-title">
        <h2 id="order-title">ご注文</h2>
        {product.questions.map((q) => (
          <div key={q.id} className="ofield">
            <span className="ofield-label">
              {q.label}
              {q.required ? <span className="required">必須</span> : <span className="optional">任意</span>}
            </span>
            {q.kind === 'choice' ? (
              <div className="choice-list" role="radiogroup" aria-label={q.label}>
                {q.choices?.map((c) => {
                  const on = answers[q.id] === c.id
                  return (
                    <label key={c.id} className={on ? 'choice on' : 'choice'}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={on}
                        onChange={() => setAnswers({ ...answers, [q.id]: c.id })}
                      />
                      <span>{c.label}</span>
                      {c.extraPrice !== 0 && <span className="extra">{extraYen(c.extraPrice)}</span>}
                    </label>
                  )
                })}
              </div>
            ) : (
              <input
                className="otext"
                aria-label={q.label}
                value={answers[q.id] ?? ''}
                maxLength={200}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
            )}
          </div>
        ))}
        <div className="ofield qty-row">
          <span className="ofield-label">個数</span>
          <div className="stepper">
            <button type="button" aria-label="1つ減らす" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}>−</button>
            <output aria-live="polite" aria-label="個数">{quantity}</output>
            <button type="button" aria-label="1つ増やす" disabled={quantity >= limit} onClick={() => setQuantity(quantity + 1)}>＋</button>
          </div>
          {max !== null && <span className="ofield-hint">残り{max}個{inCart > 0 ? `（カートに${inCart}個）` : ''}</span>}
        </div>
        {price !== null && (
          <p className="order-subtotal">
            商品代 <strong>{yen(price * quantity)}</strong>
            <span className="ofield-hint">（送料は次の画面で）</span>
          </p>
        )}
        {error && <p className="oerror" role="alert">{error}</p>}
      </section>
      <div className="buy-bar">
        <button type="button" className="buy-button" onClick={add}>
          カートに入れる
        </button>
      </div>
      {added && (
        <div className="sheet-backdrop" onClick={() => setAdded(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="カートに入れました" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title"><span className="sheet-check" aria-hidden="true">✓</span>カートに入れました</p>
            <p className="ofield-hint">カートの中：{cartCount(cart)}点</p>
            <div className="sheet-actions">
              <button type="button" className="secondary-button" onClick={() => setAdded(false)}>
                買い物を続ける
              </button>
              <Link to="/cart" className="buy-button sheet-go">
                カートを見る
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
