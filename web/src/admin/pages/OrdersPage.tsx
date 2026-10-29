import { PREFECTURES } from '@domain/prefectures.ts'
import type { Carrier, Order } from '@domain/types.ts'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { DATA_MODE } from '../../config.ts'
import { yen } from '../../lib/format.ts'
import { CARRIER_LABEL, ORDER_TABS, STATUS_LABEL, formatDate, nextStatus, shipmentError, statusPatch, type OrderTabId } from '../../lib/orders.ts'
import { useAdmin } from '../AdminContext.tsx'
import { ConfirmButton, Field } from '../ui.tsx'
import { FormSkeleton, ListSkeleton } from '../../components/Loading.tsx'

const prefName = (code: string) => PREFECTURES.find((p) => p.code === code)?.name ?? ''

function StatusBadge({ order }: { order: Order }) {
  return <span className={`status-badge s-${order.status}`}>{STATUS_LABEL[order.status]}</span>
}

export function OrdersPage() {
  const { data } = useAdmin()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState(false)
  const [params, setParams] = useSearchParams()
  const tab = (ORDER_TABS.find((t) => t.id === params.get('tab'))?.id ?? 'todo') as OrderTabId

  useEffect(() => {
    data.listOrders().then(setOrders, () => setError(true))
  }, [data])

  if (error) return <p className="status">読み込めませんでした。開き直してください。</p>
  if (!orders) return <ListSkeleton />

  const current = ORDER_TABS.find((t) => t.id === tab)!
  const shown = orders.filter((o) => (current.statuses as readonly string[]).includes(o.status))
  const count = (id: OrderTabId) => orders.filter((o) => (ORDER_TABS.find((t) => t.id === id)!.statuses as readonly string[]).includes(o.status)).length

  return (
    <section>
      <div className="admin-page-head">
        <h1>注文</h1>
      </div>
      {DATA_MODE === 'sample' && <p className="afield-hint">いま並んでいるのは、お試しのにせの注文です。</p>}
      <div className="tab-row" role="tablist" aria-label="注文の分け方">
        {ORDER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            className={t.id === tab ? 'tab on' : 'tab'}
            onClick={() => setParams(t.id === 'todo' ? {} : { tab: t.id }, { replace: true })}
          >
            {t.label}
            <span className="tab-count">{count(t.id)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="status">{tab === 'todo' ? '対応が必要な注文はありません。' : '注文はありません。'}</p>
      ) : (
        <ul className="admin-list">
          {shown.map((o) => (
            <li key={o.id} className="admin-item">
              <Link to={`/admin/orders/${o.id}`} className="admin-item-row order-row">
                <span className="admin-item-body">
                  <span className="order-top">
                    <StatusBadge order={o} />
                    <span className="order-date">{formatDate(o.createdAtMs)}</span>
                  </span>
                  <span className="admin-item-name">{o.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join('、')}</span>
                  <span className="admin-item-meta">
                    {o.address.name} 様・{prefName(o.address.prefecture)}・<strong>{yen(o.total)}</strong>
                  </span>
                </span>
                <span className="chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { data, toast } = useAdmin()
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [carrier, setCarrier] = useState<Carrier | ''>('')
  const [tracking, setTracking] = useState('')
  const [shipError, setShipError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    data.getOrder(id).then((o) => {
      setOrder(o)
      setCarrier(o?.carrier ?? '')
      setTracking(o?.trackingNumber ?? '')
    })
  }, [data, id])

  if (order === undefined) return <FormSkeleton />
  if (order === null) return <p className="status">この注文は見つかりませんでした。<Link to="/admin">注文一覧へ</Link></p>

  const update = async (patch: Partial<Order>, message: string) => {
    setBusy(true)
    try {
      await data.updateOrder(order.id, patch)
      setOrder({ ...order, ...patch })
      toast(message)
    } catch {
      toast('保存できませんでした。もう一度お試しください')
    } finally {
      setBusy(false)
    }
  }
  const next = nextStatus(order.status)
  const a = order.address

  return (
    <section className="product-form">
      <div className="admin-page-head">
        <Link to="/admin" className="back-button"><span aria-hidden="true">‹</span> 注文一覧</Link>
        <h1>注文 {order.number}</h1>
      </div>

      <div className="aform-section">
        <div className="order-top">
          <StatusBadge order={order} />
          <span className="order-date">{formatDate(order.createdAtMs)} のご注文</span>
        </div>
        <ol className="status-steps" aria-label="注文の進み具合">
          {(['paid', 'in_production', 'shipped', 'completed'] as const).map((s) => {
            const order4 = ['paid', 'in_production', 'shipped', 'completed']
            const done = order.status !== 'cancelled' && order4.indexOf(order.status) >= order4.indexOf(s)
            return (
              <li key={s} className={done ? 'done' : ''}>
                {STATUS_LABEL[s]}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="aform-section">
        <h2>注文の内容</h2>
        {order.items.map((it, i) => (
          <div key={i} className="order-item">
            <p className="order-item-name">
              {it.name}
              <span className="order-qty">× {it.quantity}</span>
            </p>
            {it.answers.length > 0 && (
              <dl className="answers">
                {it.answers.map((ans) => (
                  <div key={ans.questionId}>
                    <dt>{ans.label}</dt>
                    <dd>
                      {ans.answer || '（なし）'}
                      {ans.extraPrice !== 0 && <span className="extra">{ans.extraPrice > 0 ? '+' : ''}{yen(ans.extraPrice)}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="order-line">{yen(it.unitPrice)} × {it.quantity} = {yen(it.unitPrice * it.quantity)}</p>
          </div>
        ))}
        <dl className="totals">
          <div><dt>商品</dt><dd>{yen(order.subtotal)}</dd></div>
          <div><dt>送料</dt><dd>{yen(order.shipping)}</dd></div>
          <div className="grand"><dt>合計</dt><dd>{yen(order.total)}</dd></div>
        </dl>
        {order.note && (
          <div className="order-note">
            <span className="afield-label">お客さんからの連絡</span>
            <p>{order.note}</p>
          </div>
        )}
      </div>

      <div className="aform-section">
        <h2>お届け先</h2>
        <address className="address-block">
          〒{a.postalCode}
          <br />
          {prefName(a.prefecture)}{a.address1}
          {a.address2 && <><br />{a.address2}</>}
          <br />
          {a.name} 様
          {a.phone && <><br />電話 {a.phone}</>}
        </address>
        <p className="afield-hint">メール：{order.email}</p>
        <CopyButton
          text={`〒${a.postalCode}\n${prefName(a.prefecture)}${a.address1}${a.address2 ? `\n${a.address2}` : ''}\n${a.name} 様${a.phone ? `\n${a.phone}` : ''}`}
        />
      </div>

      {(order.status === 'in_production' || order.status === 'shipped') && (
        <div className="aform-section">
          <h2>{order.status === 'shipped' ? '発送の連絡（直す）' : '発送の連絡'}</h2>
          <Field label="配送会社">
            <select value={carrier} onChange={(e) => setCarrier(e.target.value as Carrier | '')}>
              <option value="">選んでください</option>
              {Object.entries(CARRIER_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="追跡番号" hint="「その他」のときは空でもかまいません">
            <input inputMode="numeric" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="例：1234-5678-9012" />
          </Field>
          {shipError && <p className="afield-error">{shipError}</p>}
          <button
            type="button"
            className={busy ? 'buy-button is-busy' : 'buy-button'}
            disabled={busy}
            onClick={() => {
              const err = shipmentError(carrier, tracking)
              setShipError(err ?? '')
              if (err || !carrier) return
              update(
                statusPatch(order, 'shipped', Date.now(), { carrier, trackingNumber: tracking }),
                order.status === 'shipped' ? '発送の連絡を直しました' : '発送済みにしました',
              )
            }}
          >
            {order.status === 'shipped' ? '配送会社・追跡番号を直す' : '発送済みにする'}
          </button>
          <p className="afield-hint">お客さんへの「発送しました」メールは、ステップ3で自動で送られるようになります。</p>
        </div>
      )}

      {next === 'in_production' && (
        <div className="aform-section">
          <h2>次にすること</h2>
          <button type="button" className="buy-button" disabled={busy} onClick={() => update(statusPatch(order, 'in_production', Date.now()), '制作中にしました')}>
            制作中にする
          </button>
        </div>
      )}

      {order.status === 'shipped' && (
        <div className="aform-section">
          <h2>受け取り</h2>
          <p className="afield-hint">お客さんが「受け取りました」を押すか、発送から14日たつと自動で完了になります（ステップ3・4で作ります）。</p>
        </div>
      )}

      {(order.status === 'paid' || order.status === 'in_production') && (
        <div className="aform-section">
          <h2>キャンセル</h2>
          <p className="afield-hint">返金は、いまは Stripe の管理画面で行います（ステップ3で決済とつなぎます）。返金したら、ここでキャンセルにしてください。</p>
          <ConfirmButton
            label="キャンセルにする"
            confirmLabel="キャンセルにする"
            message={`注文 ${order.number} をキャンセルにします。元に戻せません。`}
            onConfirm={() => update(statusPatch(order, 'cancelled', Date.now()), 'キャンセルにしました')}
          />
        </div>
      )}
    </section>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="secondary-button small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 2000)
        } catch {
          // コピーできないときは、住所の文字を長押しで選んでもらう
          const sel = window.getSelection()
          const el = document.querySelector('.address-block')
          if (sel && el) {
            const r = document.createRange()
            r.selectNodeContents(el)
            sel.removeAllRanges()
            sel.addRange(r)
          }
        }
      }}
    >
      {done ? 'コピーしました' : 'お届け先をコピー（伝票づくり用）'}
    </button>
  )
}
