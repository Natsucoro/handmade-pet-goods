import { cartShipping, type CheckoutErrors } from '@domain/checkout.ts'
import { PricingError } from '@domain/pricing.ts'
import { PREFECTURES, isPrefectureCode } from '@domain/prefectures.ts'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CHECKOUT_ENABLED } from '../../config.ts'
import { FormSkeleton } from '../../components/Loading.tsx'
import { CheckoutError } from '../../data/ShopData.ts'
import { useShopData } from '../../data/ShopDataContext.tsx'
import { clearCart, useCart } from '../../lib/cart.ts'
import { yen } from '../../lib/format.ts'
import { rememberOrder } from '../../lib/myOrders.ts'
import { useLoad } from '../../lib/useLoad.ts'
import { useCartDetails } from './useCartDetails.ts'

interface Form {
  name: string
  postalCode: string
  prefecture: string
  address1: string
  address2: string
  phone: string
  email: string
  note: string
}
const EMPTY: Form = { name: '', postalCode: '', prefecture: '', address1: '', address2: '', phone: '', email: '', note: '' }

export function CheckoutPage() {
  const data = useShopData()
  const lines = useCart()
  const details = useCartDetails(lines)
  const settings = useLoad(() => data.getPublicSettings(), [data])
  // 注文を送ったあとはカートが空になるので、ここでは戻さない
  const [placing, setPlacing] = useState(false)

  if (!CHECKOUT_ENABLED) return <Navigate to="/" replace />
  if (lines.length === 0 && !placing) return <Navigate to="/cart" replace />
  if (details.state === 'loading' || settings.state === 'loading') return <FormSkeleton />
  if (details.state === 'error' || settings.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>
  if (!details.ok && !placing) return <Navigate to="/cart" replace />
  return <CheckoutForm details={details} phoneRequired={settings.value.phoneRequired} onPlacing={setPlacing} />
}

type Details = Extract<ReturnType<typeof useCartDetails>, { state: 'done' }>

function CheckoutForm({ details, phoneRequired, onPlacing }: { details: Details; phoneRequired: boolean; onPlacing: (b: boolean) => void }) {
  const data = useShopData()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm({ ...form, [k]: e.target.value })
    // 直したところのエラーは消す
    if (k in errors) setErrors({ ...errors, [k]: undefined })
  }

  const items = details.rows.map((r) => r.item!).filter(Boolean)
  let shipping: number | null = null
  let quoteError = ''
  if (isPrefectureCode(form.prefecture)) {
    try {
      shipping = cartShipping(items.map((i) => details.tables[details.products[i.productId].shippingTableId]), form.prefecture)
    } catch (e) {
      quoteError = e instanceof PricingError ? e.message : '送料を計算できませんでした'
    }
  }
  const total = shipping === null ? null : details.subtotal + shipping

  const submit = async () => {
    setBusy(true)
    setFailed('')
    try {
      onPlacing(true)
      const placed = await data.placeOrder({
        items: details.rows.map((r) => ({ productId: r.line.productId, answers: r.line.answers, quantity: r.line.quantity })),
        address: {
          name: form.name,
          postalCode: form.postalCode,
          prefecture: form.prefecture as never,
          address1: form.address1,
          ...(form.address2.trim() ? { address2: form.address2 } : {}),
          ...(form.phone.trim() ? { phone: form.phone } : {}),
        },
        email: form.email,
        note: form.note,
      })
      rememberOrder({ ...placed, createdAtMs: Date.now() })
      clearCart()
      navigate(`/pay/${encodeURIComponent(placed.orderId)}?t=${encodeURIComponent(placed.token)}`, { replace: true })
    } catch (e) {
      onPlacing(false)
      if (e instanceof CheckoutError) {
        setErrors(e.errors)
        setTimeout(() => document.querySelector('.has-oerror')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      } else {
        setFailed('送れませんでした。電波のよいところで、もう一度お試しください。')
      }
      setBusy(false)
    }
  }

  return (
    <form
      className="checkout"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="back-bar">
        <Link to="/cart" className="back-button">
          <span aria-hidden="true">‹</span> カートにもどる
        </Link>
      </div>
      <h1 className="page-title">購入手続き</h1>
      <ol className="flow-steps" aria-label="手続きの進み具合">
        <li className="on">お届け先</li>
        <li>お支払い</li>
        <li>完了</li>
      </ol>

      <section className="panel">
        <h2>ご注文の内容（{items.reduce((n, i) => n + i.quantity, 0)}点）</h2>
        {items.map((it, i) => (
          <div key={i} className="co-block">
            <p className="co-item">
              <strong>{it.name}</strong> × {it.quantity}
              <span className="co-line-price">{yen(it.unitPrice * it.quantity)}</span>
            </p>
            {it.answers.length > 0 && (
              <dl className="co-answers">
                {it.answers.map((x) => (
                  <div key={x.questionId}>
                    <dt>{x.label}</dt>
                    <dd>{x.answer}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
        {errors.items && <p className="oerror has-oerror">{errors.items}</p>}
      </section>
      <section className="panel">
        <h2>お届け先</h2>
        <OField label="お名前" error={errors.name}>
          <input autoComplete="name" value={form.name} onChange={set('name')} placeholder="例：山田 花子" />
        </OField>
        <OField label="郵便番号" error={errors.postalCode}>
          <input autoComplete="postal-code" inputMode="numeric" value={form.postalCode} onChange={set('postalCode')} placeholder="例：123-4567" />
        </OField>
        <OField label="都道府県" error={errors.prefecture || quoteError}>
          <select autoComplete="address-level1" value={form.prefecture} onChange={set('prefecture')}>
            <option value="">選んでください</option>
            {PREFECTURES.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </OField>
        <OField label="市区町村・番地" error={errors.address1}>
          <input autoComplete="address-line1" value={form.address1} onChange={set('address1')} placeholder="例：〇〇市〇〇町1-2-3" />
        </OField>
        <OField label="建物名・部屋番号" optional>
          <input autoComplete="address-line2" value={form.address2} onChange={set('address2')} placeholder="例：〇〇マンション101" />
        </OField>
        <OField label="電話番号" optional={!phoneRequired} error={errors.phone} hint="配送会社から連絡があるときに使います">
          <input type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="例：090-1234-5678" />
        </OField>
      </section>

      <section className="panel">
        <h2>ご連絡先</h2>
        <OField label="メールアドレス" error={errors.email} hint="ご注文の確認や発送のお知らせを送ります">
          <input type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} placeholder="例：hanako@example.com" />
        </OField>
        <OField label="ショップへの連絡" optional error={errors.note}>
          <textarea rows={3} maxLength={1000} value={form.note} onChange={set('note')} placeholder="ご希望などがあれば" />
        </OField>
      </section>

      <section className="panel">
        <h2>お支払い金額</h2>
        <dl className="totals">
          <div><dt>商品代</dt><dd>{yen(details.subtotal)}</dd></div>
          <div><dt>送料</dt><dd>{shipping !== null ? yen(shipping) : '都道府県を選ぶと出ます'}</dd></div>
          <div className="grand"><dt>合計</dt><dd>{total !== null ? yen(total) : '—'}</dd></div>
        </dl>
        <p className="ofield-hint">同じ配送方法の商品は、送料1回分にまとめています。</p>
      </section>

      {failed && <p className="oerror" role="alert">{failed}</p>}
      <div className="buy-bar">
        <button type="submit" className={busy ? 'buy-button is-busy' : 'buy-button'} disabled={busy}>
          {busy ? '送っています…' : total !== null ? `お支払いへ（${yen(total)}）` : 'お支払いへ'}
        </button>
      </div>
    </form>
  )
}

function OField({ label, error, hint, optional, children }: { label: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className={error ? 'ofield has-oerror' : 'ofield'}>
      <span className="ofield-label">
        {label}
        {optional ? <span className="optional">任意</span> : <span className="required">必須</span>}
      </span>
      {children}
      {hint && !error && <span className="ofield-hint">{hint}</span>}
      {error && <span className="oerror">{error}</span>}
    </label>
  )
}
