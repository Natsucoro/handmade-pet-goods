import { DEFAULT_PUBLIC_SETTINGS, RETENTION_CHOICES, type PublicSettings, type ShopSettings } from '@domain/types.ts'
import { useEffect, useState } from 'react'
import { countPurgeable, monthsLabel } from '../../lib/orders.ts'
import { useAdmin } from '../AdminContext.tsx'
import { ConfirmButton, Field } from '../ui.tsx'

export function SettingsPage() {
  const { data, changed, toast } = useAdmin()
  const [pub, setPub] = useState<PublicSettings | null>(null)
  const [shop, setShop] = useState<ShopSettings | null>(null)
  const [retention, setRetention] = useState<number>(24)
  const [purgeCount, setPurgeCount] = useState<number | null>(null)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    Promise.all([data.getPublicSettings(), data.getSettings()]).then(([p, s]) => {
      setPub(p)
      setShop(s)
      setRetention(s.retentionMonths)
    })
  }, [data])

  if (!pub || !shop) return <p className="status">読み込み中…</p>

  const savePublic = async (next: PublicSettings, message: string) => {
    try {
      await data.savePublicSettings(next)
      setPub(next)
      changed()
      toast(message)
    } catch {
      toast('保存できませんでした')
    }
  }
  const saveShop = async (next: ShopSettings, message: string) => {
    try {
      await data.saveSettings(next)
      setShop(next)
      toast(message)
    } catch {
      toast('保存できませんでした')
    }
  }

  return (
    <section className="product-form">
      <div className="admin-page-head">
        <h1>設定</h1>
      </div>

      <form
        className="aform-section"
        onSubmit={(e) => {
          e.preventDefault()
          const name = (new FormData(e.currentTarget).get('shopName') as string).trim()
          if (!name) return setNameError('ショップ名を入れてください')
          setNameError('')
          savePublic({ ...pub, shopName: name }, 'ショップ名を保存しました')
        }}
      >
        <h2>ショップ名</h2>
        <Field label="お店の画面のいちばん上に出る名前" error={nameError}>
          <input name="shopName" defaultValue={pub.shopName} placeholder={DEFAULT_PUBLIC_SETTINGS.shopName} />
        </Field>
        <button type="submit" className="secondary-button">ショップ名を保存</button>
      </form>

      <div className="aform-section">
        <h2>注文のときの電話番号</h2>
        <div className="segmented" role="radiogroup" aria-label="注文のときの電話番号">
          {[false, true].map((req) => (
            <label key={String(req)} className={pub.phoneRequired === req ? 'on' : ''}>
              <input
                type="radio"
                name="phoneRequired"
                checked={pub.phoneRequired === req}
                onChange={() => savePublic({ ...pub, phoneRequired: req }, req ? '電話番号を必須にしました' : '電話番号を任意にしました')}
              />
              {req ? '必須' : '任意（なくてもよい）'}
            </label>
          ))}
        </div>
        <p className="afield-hint">配送会社によっては、伝票に電話番号が必要です。</p>
      </div>

      <div className="aform-section">
        <h2>自分で登録した色</h2>
        <p className="afield-hint">商品の説明文の「色」で使えます。新しい色は、説明文の「色」→「＋」から登録できます。</p>
        {shop.customColors.length === 0 ? (
          <p className="afield-hint">まだ登録した色はありません。</p>
        ) : (
          <ul className="color-list">
            {shop.customColors.map((hex) => (
              <li key={hex}>
                <span className="swatch" style={{ background: hex }} aria-hidden="true" />
                <code>{hex}</code>
                <ConfirmButton
                  label="削除"
                  ariaLabel={`色 ${hex} を削除`}
                  className="small-danger"
                  confirmLabel="削除する"
                  message="この色を一覧から削除しますか？（すでに説明文で使っている色はそのまま残ります）"
                  onConfirm={() => saveShop({ ...shop, customColors: shop.customColors.filter((c) => c !== hex) }, '色を削除しました')}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="aform-section">
        <h2>お客さんの個人情報を消すまでの期間</h2>
        <p className="afield-hint">
          取引が終わってからこの期間がたつと、お届け先の住所・電話・メッセージを自動で消します（金額や商品などの売上の記録は残ります）。自動で消す仕組みはステップ3〜4で作ります。
        </p>
        <Field label="期間">
          <select
            value={retention}
            onChange={(e) => {
              const m = Number(e.target.value)
              setRetention(m)
              setPurgeCount(null)
            }}
          >
            {RETENTION_CHOICES.map((m) => (
              <option key={m} value={m}>{monthsLabel(m)}{m === 24 ? '（最初の設定）' : ''}</option>
            ))}
          </select>
        </Field>
        {retention !== shop.retentionMonths &&
          (retention > shop.retentionMonths ? (
            <button type="button" className="buy-button" onClick={() => saveShop({ ...shop, retentionMonths: retention }, '期間を保存しました')}>
              {monthsLabel(retention)}に変える
            </button>
          ) : purgeCount === null ? (
            <button
              type="button"
              className="buy-button"
              onClick={async () => setPurgeCount(countPurgeable(await data.listOrders(), retention, Date.now()))}
            >
              短くしたときに消える件数を確かめる
            </button>
          ) : (
            <div className="confirm-box" role="alertdialog" aria-label="期間を短くする">
              <p>
                {monthsLabel(retention)}にすると、<strong>{purgeCount}件</strong>の注文のお届け先・電話・メッセージが、すぐに消える対象になります。消したものは元に戻せません。
              </p>
              <div className="confirm-actions">
                <button type="button" className="secondary-button" onClick={() => { setRetention(shop.retentionMonths); setPurgeCount(null) }}>
                  やめる
                </button>
                <button
                  type="button"
                  className="danger-button solid"
                  onClick={() => {
                    saveShop({ ...shop, retentionMonths: retention }, '期間を保存しました')
                    setPurgeCount(null)
                  }}
                >
                  {monthsLabel(retention)}に変える
                </button>
              </div>
            </div>
          ))}
      </div>
    </section>
  )
}
