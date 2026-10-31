import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormSkeleton } from '../../components/Loading.tsx'
import { useShopData } from '../../data/ShopDataContext.tsx'
import { yen } from '../../lib/format.ts'
import { orderStatusPath } from '../../lib/myOrders.ts'
import { useLoad } from '../../lib/useLoad.ts'

/**
 * テストのお支払い画面。本物のお金は動かない（カード番号も入れない）。
 * ステップ3で、ここが Stripe のお支払い画面に置きかわる。
 */
export function PayPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const data = useShopData()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const loaded = useLoad(() => data.getOrderStatus(id, token), [data, id, token])

  if (loaded.state === 'loading') return <FormSkeleton />
  if (loaded.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>
  const order = loaded.value
  if (!order) {
    return (
      <div className="status">
        <p>この注文は見つかりませんでした。</p>
        <Link to="/" className="primary-small">商品一覧へ</Link>
      </div>
    )
  }
  if (order.status !== 'pending_payment') return <Navigate to={orderStatusPath({ orderId: id, token })} replace />

  const pay = async () => {
    setBusy(true)
    setFailed('')
    try {
      await data.testPay(id, token)
      navigate(`${orderStatusPath({ orderId: id, token })}&thanks=1`, { replace: true })
    } catch {
      setFailed('お支払いできませんでした。もう一度お試しください。')
      setBusy(false)
    }
  }

  return (
    <div className="checkout">
      <h1 className="page-title">お支払い</h1>
      <ol className="flow-steps" aria-label="手続きの進み具合">
        <li className="done">お届け先</li>
        <li className="on">お支払い</li>
        <li>完了</li>
      </ol>
      <section className="panel">
        <h2>注文番号 {order.number}</h2>
        {order.items.map((it, i) => (
          <p key={i} className="co-item">
            <strong>{it.name}</strong> × {it.quantity}
          </p>
        ))}
        <dl className="totals">
          <div><dt>商品代</dt><dd>{yen(order.subtotal)}</dd></div>
          <div><dt>送料</dt><dd>{yen(order.shipping)}</dd></div>
          <div className="grand"><dt>お支払い金額</dt><dd>{yen(order.total)}</dd></div>
        </dl>
      </section>
      <section className="panel test-pay">
        <h2>テストのお支払い</h2>
        <p>
          いまは<strong>テスト</strong>です。ボタンを押しても<strong>本物のお金は動きません</strong>。カード番号も入れません。
        </p>
        <p className="ofield-hint">お店を始めるときに、ここがカード払いの画面（Stripe）に変わります。</p>
      </section>
      {failed && <p className="oerror" role="alert">{failed}</p>}
      <div className="buy-bar">
        <button type="button" className={busy ? 'buy-button is-busy' : 'buy-button'} disabled={busy} onClick={pay}>
          {busy ? 'お支払い中…' : `支払う（テスト）${yen(order.total)}`}
        </button>
      </div>
    </div>
  )
}
