import { maxQuantity } from '@domain/checkout.ts'
import { unitPrice } from '@domain/pricing.ts'
import type { Product } from '@domain/types.ts'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extraYen, yen } from '../../lib/format.ts'

import { loadDraft, saveDraft, type OrderDraft } from '../../lib/orderDraft.ts'

/** 商品ページの「ご注文」：選ぶ内容と個数。決まったら購入手続きへ */
export function OrderSection({ product }: { product: Product }) {
  const navigate = useNavigate()
  const [initial] = useState(() => loadDraft(product.id))
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {})
  const [quantity, setQuantity] = useState(() => Math.max(1, Math.min(initial?.quantity ?? 1, maxQuantity(product) ?? 20, 20)))
  const [error, setError] = useState('')
  const max = maxQuantity(product)
  const limit = Math.min(max ?? 20, 20)
  const choiceAnswers = Object.fromEntries(product.questions.filter((q) => q.kind === 'choice' && answers[q.id]).map((q) => [q.id, answers[q.id]]))
  let price: number | null = null
  try {
    price = unitPrice(product, choiceAnswers)
  } catch {
    price = null
  }

  const go = () => {
    const missing = product.questions.find((q) => q.required && !(answers[q.id] ?? '').trim())
    if (missing) {
      setError(`「${missing.label}」を選んでください`)
      document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setError('')
    saveDraft(product.id, { answers, quantity })
    navigate(`/checkout/${encodeURIComponent(product.id)}`, { state: { answers, quantity } satisfies OrderDraft })
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
          {max !== null && <span className="ofield-hint">残り{max}個</span>}
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
        <button type="button" className="buy-button" onClick={go}>
          購入手続きへ
        </button>
      </div>
    </>
  )
}
