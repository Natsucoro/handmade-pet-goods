import type { OrderStatus } from '@domain/types.ts'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FormSkeleton } from '../../components/Loading.tsx'
import type { OrderStatusView } from '../../data/ShopData.ts'
import { useShopData } from '../../data/ShopDataContext.tsx'
import { yen } from '../../lib/format.ts'
import { listMyOrders, orderStatusPath } from '../../lib/myOrders.ts'
import { CARRIER_LABEL, formatDate } from '../../lib/orders.ts'
import { useLoad } from '../../lib/useLoad.ts'

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'paid', label: 'ご注文' },
  { status: 'in_production', label: '制作中' },
  { status: 'shipped', label: '発送' },
  { status: 'completed', label: 'お届け' },
]
const RANK: Record<OrderStatus, number> = { pending_payment: -1, paid: 0, in_production: 1, shipped: 2, completed: 3, cancelled: -1 }

function message(o: OrderStatusView): string {
  switch (o.status) {
    case 'pending_payment':
      return 'お支払いがまだ終わっていません。'
    case 'paid':
      return o.leadDays ? `ご注文を受け付けました。約${o.leadDays}日でお届けします。` : 'ご注文を受け付けました。'
    case 'in_production':
      return 'ただいま、心をこめて作っています。'
    case 'shipped':
      return '発送しました。届いたら下の「受け取りました」を押してください。'
    case 'completed':
      return 'お届けが終わりました。ありがとうございました。'
    case 'cancelled':
      return 'このご注文はキャンセルになりました。お支払いは返金されます。'
  }
}

export function OrderStatusPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const token = params.get('t') ?? ''
  const thanks = params.get('thanks') === '1'
  const data = useShopData()
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState('')
  const loaded = useLoad(() => data.getOrderStatus(id, token), [data, id, token, version])

  if (loaded.state === 'loading') return <FormSkeleton />
  if (loaded.state === 'error') return <p className="status">読み込めませんでした。時間をおいて開き直してください。</p>
  const o = loaded.value
  if (!o) {
    return (
      <div className="status">
        <p>この注文は見つかりませんでした。メールにあるリンクから開き直してください。</p>
        <Link to="/" className="primary-small">商品一覧へ</Link>
      </div>
    )
  }
  const rank = RANK[o.status]

  const received = async () => {
    setBusy(true)
    setFailed('')
    try {
      await data.confirmReceived(id, token)
      setConfirming(false)
      setVersion((v) => v + 1)
    } catch {
      setFailed('うまく送れませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="checkout">
      {thanks && o.status !== 'cancelled' && (
        <section className="thanks" role="status">
          <span className="thanks-mark" aria-hidden="true">✓</span>
          <h1>ご注文ありがとうございます</h1>
          <p>注文番号 <strong>{o.number}</strong></p>
          <p className="ofield-hint">確認のメールをお送りします（テスト中は送られません）。</p>
          <button type="button" className="link-button" onClick={() => setParams({ t: token }, { replace: true })}>
            閉じる
          </button>
        </section>
      )}
      {!thanks && <h1 className="page-title">ご注文の状況</h1>}

      <section className="panel">
        <h2>注文番号 {o.number}</h2>
        <p className="order-msg">{message(o)}</p>
        {o.status !== 'cancelled' && o.status !== 'pending_payment' && (
          <ol className="track-steps" aria-label="お届けまでの進み具合">
            {STEPS.map((s) => (
              <li key={s.status} className={rank >= RANK[s.status] ? 'done' : ''} aria-current={rank === RANK[s.status] ? 'step' : undefined}>
                {s.label}
              </li>
            ))}
          </ol>
        )}
        {o.status === 'pending_payment' && (
          <Link to={`/pay/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`} className="primary-small">
            お支払いへ
          </Link>
        )}
        {(o.status === 'shipped' || o.status === 'completed') && o.carrier && (
          <p className="ship-info">
            {CARRIER_LABEL[o.carrier]}
            {o.trackingNumber && <>・追跡番号 {o.trackingNumber}</>}
            {o.shippedAtMs && <span className="ofield-hint">（{formatDate(o.shippedAtMs)} 発送）</span>}
          </p>
        )}
      </section>

      {o.status === 'shipped' && (
        <section className="panel">
          <h2>届きましたか？</h2>
          {confirming ? (
            <div className="confirm-box" role="alertdialog" aria-label="受け取りの確認">
              <p>商品を受け取ったことをお知らせします。よろしいですか？</p>
              <div className="confirm-actions">
                <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirming(false)}>
                  まだ
                </button>
                <button type="button" className={busy ? 'primary-small is-busy' : 'primary-small'} disabled={busy} onClick={received}>
                  受け取りました
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="primary-small" onClick={() => setConfirming(true)}>
              受け取りました
            </button>
          )}
          {failed && <p className="oerror" role="alert">{failed}</p>}
        </section>
      )}

      <section className="panel">
        <h2>ご注文の内容</h2>
        {o.items.map((it, i) => (
          <div key={i} className="co-block">
            <p className="co-item">
              <strong>{it.name}</strong> × {it.quantity}
              <span className="co-line-price">{yen(it.unitPrice * it.quantity)}</span>
            </p>
            {it.answers.length > 0 && (
              <dl className="co-answers">
                {it.answers.map((a) => (
                  <div key={a.questionId}>
                    <dt>{a.label}</dt>
                    <dd>{a.answer}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
        <dl className="totals">
          <div><dt>商品代</dt><dd>{yen(o.subtotal)}</dd></div>
          <div><dt>送料</dt><dd>{yen(o.shipping)}</dd></div>
          <div className="grand"><dt>合計</dt><dd>{yen(o.total)}</dd></div>
        </dl>
        <p className="ofield-hint">{formatDate(o.createdAtMs)} のご注文・{o.name} 様</p>
      </section>

      <div className="page-end-nav">
        <Link to="/" className="secondary-button">
          <span aria-hidden="true">‹</span> 商品一覧へ
        </Link>
      </div>
    </div>
  )
}

/** この端末でした注文の一覧（テストのときに、注文の状況へすぐ行けるように） */
export function MyOrdersPage() {
  const list = listMyOrders()
  return (
    <div className="checkout">
      <h1 className="page-title">ご注文の状況</h1>
      {list.length === 0 ? (
        <p className="status">この端末でのご注文はまだありません。</p>
      ) : (
        <ul className="my-orders">
          {list.map((o) => (
            <li key={o.orderId}>
              <Link to={orderStatusPath(o)}>
                <span>注文番号 {o.number}</span>
                <span className="ofield-hint">{formatDate(o.createdAtMs)}</span>
                <span className="chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="ofield-hint">ご注文の確認メールにあるリンクからも見られます。</p>
    </div>
  )
}
