import type { CheckoutErrors } from '@domain/checkout.ts'
import { PricingError, quote } from '@domain/pricing.ts'
import { PREFECTURES, isPrefectureCode } from '@domain/prefectures.ts'
import type { Product, ShippingTable } from '@domain/types.ts'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CHECKOUT_ENABLED } from '../../config.ts'
import { FormSkeleton } from '../../components/Loading.tsx'
import { CheckoutError } from '../../data/ShopData.ts'
import { useShopData } from '../../data/ShopDataContext.tsx'
import { yen } from '../../lib/format.ts'
import { rememberOrder } from '../../lib/myOrders.ts'
import { useLoad } from '../../lib/useLoad.ts'
import { loadDraft, saveDraft, type OrderDraft } from '../../lib/orderDraft.ts'

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
  const { id = '' } = useParams()
  const location = useLocation()
  const data = useShopData()
  const draft = (location.state as OrderDraft | null) ?? loadDraft(id)
  const loaded = useLoad(async () => {
    const product = await data.getProduct(id)
    const [table, settings] = await Promise.all([product ? data.getShippingTable(product.shippingTableId) : null, data.getPublicSettings()])
    return { product, table, settings }
  }, [data, id])

  if (!CHECKOUT_ENABLED || !draft) return <Navigate to={`/products/${encodeURIComponent(id)}`} replace />
  if (loaded.state === 'loading') return <FormSkeleton />
  if (loaded.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>
  const { product, table, settings } = loaded.value
  if (!product || !table) {
    return (
      <div className="status">
        <p>この商品はいまご注文いただけません。</p>
        <Link to="/" className="primary-small">商品一覧へ</Link>
      </div>
    )
  }
  return <CheckoutForm product={product} table={table} draft={draft} phoneRequired={settings.phoneRequired} />
}

function CheckoutForm({ product, table, draft, phoneRequired }: { product: Product; table: ShippingTable; draft: OrderDraft; phoneRequired: boolean }) {
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

  const choiceAnswers = Object.fromEntries(product.questions.filter((q) => q.kind === 'choice' && draft.answers[q.id]).map((q) => [q.id, draft.answers[q.id]]))
  let q: ReturnType<typeof quote> | null = null
  let quoteError = ''
  if (isPrefectureCode(form.prefecture)) {
    try {
      q = quote(product, table, choiceAnswers, form.prefecture, draft.quantity)
    } catch (e) {
      quoteError = e instanceof PricingError ? e.message : '送料を計算できませんでした'
    }
  }

  const submit = async () => {
    setBusy(true)
    setFailed('')
    try {
      const placed = await data.placeOrder({
        productId: product.id,
        answers: draft.answers,
        quantity: draft.quantity,
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
      saveDraft(product.id, null)
      navigate(`/pay/${encodeURIComponent(placed.orderId)}?t=${encodeURIComponent(placed.token)}`, { replace: true })
    } catch (e) {
      if (e instanceof CheckoutError) {
        setErrors(e.errors)
        setTimeout(() => document.querySelector('.has-oerror')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      } else {
        setFailed('送れませんでした。電波のよいところで、もう一度お試しください。')
      }
    } finally {
      setBusy(false)
    }
  }

  const answered = product.questions
    .map((qq) => {
      const v = draft.answers[qq.id]
      if (!v) return null
      const label = qq.kind === 'choice' ? qq.choices?.find((c) => c.id === v)?.label : v
      return label ? { q: qq.label, a: label } : null
    })
    .filter((x): x is { q: string; a: string } => !!x)

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
        <button type="button" className="back-button" onClick={() => navigate(-1)}>
          <span aria-hidden="true">‹</span> 商品にもどる
        </button>
      </div>
      <h1 className="page-title">購入手続き</h1>
      <ol className="flow-steps" aria-label="手続きの進み具合">
        <li className="on">お届け先</li>
        <li>お支払い</li>
        <li>完了</li>
      </ol>

      <section className="panel">
        <h2>ご注文の内容</h2>
        <p className="co-item">
          <strong>{product.name}</strong> × {draft.quantity}
        </p>
        {answered.length > 0 && (
          <dl className="co-answers">
            {answered.map((x) => (
              <div key={x.q}>
                <dt>{x.q}</dt>
                <dd>{x.a}</dd>
              </div>
            ))}
          </dl>
        )}
        {errors.answers && <p className="oerror has-oerror">{errors.answers}</p>}
        {errors.quantity && <p className="oerror has-oerror">{errors.quantity}</p>}
        {errors.product && <p className="oerror has-oerror">{errors.product}</p>}
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
          <div><dt>商品代</dt><dd>{q ? yen(q.subtotal) : '—'}</dd></div>
          <div><dt>送料</dt><dd>{q ? yen(q.shipping) : '都道府県を選ぶと出ます'}</dd></div>
          <div className="grand"><dt>合計</dt><dd>{q ? yen(q.total) : '—'}</dd></div>
        </dl>
      </section>

      {failed && <p className="oerror" role="alert">{failed}</p>}
      <div className="buy-bar">
        <button type="submit" className={busy ? 'buy-button is-busy' : 'buy-button'} disabled={busy}>
          {busy ? '送っています…' : q ? `お支払いへ（${yen(q.total)}）` : 'お支払いへ'}
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
