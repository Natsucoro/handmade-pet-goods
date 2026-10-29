import type { Category, ProductPhoto, ShippingTable, ShopSettings } from '@domain/types.ts'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { assetUrl } from '../../config.ts'
import { groupCategories } from '../../lib/catalog.ts'
import { useAdmin } from '../AdminContext.tsx'
import { MAX_PHOTOS, prepareImage } from '../images.ts'
import { emptyForm, formFromProduct, formToProduct, tmpId, type FormErrors, type ProductForm, type QuestionDraft } from '../productForm.ts'
import { RichTextEditor } from '../richtext/RichTextEditor.tsx'
import { ConfirmButton, Field, MoveButtons } from '../ui.tsx'
import { move } from '../util.ts'

export function ProductEditPage() {
  const { id } = useParams()
  const { data } = useAdmin()
  const [loaded, setLoaded] = useState<{ form: ProductForm; categories: Category[]; tables: ShippingTable[]; settings: ShopSettings } | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [categories, tables, settings, products] = await Promise.all([
        data.listCategories(),
        data.listShippingTables(),
        data.getSettings(),
        data.listProducts(),
      ])
      if (id) {
        const p = await data.getProduct(id)
        if (!p) return setMissing(true)
        setLoaded({ form: formFromProduct(p), categories, tables, settings })
      } else {
        // 新しい商品は一覧の一番上に出す
        const top = Math.min(1, ...products.map((p) => p.sortOrder)) - 1
        setLoaded({ form: emptyForm(data.newId(), top, tables.length === 1 ? tables[0].id : ''), categories, tables, settings })
      }
    })().catch(() => setMissing(true))
  }, [data, id])

  if (missing) return <p className="status">この商品は見つかりませんでした。<Link to="/admin">商品一覧へ</Link></p>
  if (!loaded) return <p className="status">読み込み中…</p>
  return <Editor key={loaded.form.id} initial={loaded.form} categories={loaded.categories} tables={loaded.tables} settings={loaded.settings} />
}

function Editor({
  initial,
  categories,
  tables,
  settings: initialSettings,
}: {
  initial: ProductForm
  categories: Category[]
  tables: ShippingTable[]
  settings: ShopSettings
}) {
  const { data, changed, toast, setDirty: tellDirty, leave } = useAdmin()
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
  const [removed, setRemoved] = useState<ProductPhoto[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [settings, setSettings] = useState(initialSettings)
  const set = (patch: Partial<ProductForm>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
  }

  useEffect(() => {
    tellDirty(dirty)
    return () => tellDirty(false)
  }, [dirty, tellDirty])

  // 保存していない変更があるまま閉じようとしたら、ブラウザに止めてもらう
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const save = async () => {
    const { product, errors } = formToProduct(form)
    setErrors(errors)
    if (!product) {
      toast('入力を確かめてください')
      document.querySelector('.has-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      await data.saveProduct(product, form.photos, removed)
      changed()
      setDirty(false)
      tellDirty(false)
      toast('保存しました')
      navigate('/admin')
    } catch (e) {
      console.error(e)
      toast('保存できませんでした。通信を確かめて、もう一度お試しください')
    } finally {
      setSaving(false)
    }
  }

  const grouped = groupCategories(categories)

  return (
    <form
      className="product-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="admin-page-head">
        <button type="button" className="back-button" onClick={() => leave('/admin')}><span aria-hidden="true">‹</span> 商品一覧</button>
        <h1>{form.isNew ? '商品を追加' : '商品を編集'}</h1>
      </div>

      <PhotosSection
        photos={form.photos}
        error={errors.photos}
        onChange={(photos) => set({ photos })}
        onRemove={(ph) => ph.existing && setRemoved((r) => [...r, ph.existing!])}
      />

      <section className="aform-section">
        <h2>基本</h2>
        <Field label="商品名" error={errors.name}>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="例：文鳥のつぼ巣" />
        </Field>
        <Field label="基本の値段（円・税込）" error={errors.price} hint="選択肢の追加料金は、下の「買うときの質問」で決めます">
          <input inputMode="numeric" value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="3000" />
        </Field>
        <label className="switch-row big">
          <input type="checkbox" checked={form.published} onChange={(e) => set({ published: e.target.checked })} />
          <span>お店に公開する{form.published ? '（公開中）' : '（非公開：お客さんには見えません）'}</span>
        </label>
      </section>

      <section className="aform-section">
        <h2>在庫とお届け</h2>
        <div className="segmented" role="radiogroup" aria-label="在庫の種類">
          {(['stock', 'made_to_order'] as const).map((t) => (
            <label key={t} className={form.stockType === t ? 'on' : ''}>
              <input type="radio" name="stockType" checked={form.stockType === t} onChange={() => set({ stockType: t })} />
              {t === 'stock' ? '在庫数で管理' : '受注生産'}
            </label>
          ))}
        </div>
        {form.stockType === 'stock' && (
          <>
            <Field label="在庫数" error={errors.stock}>
              <div className="stepper">
                <button type="button" aria-label="1つ減らす" onClick={() => set({ stock: String(Math.max(0, (Number(form.stock) || 0) - 1)) })}>−</button>
                <input inputMode="numeric" value={form.stock} onChange={(e) => set({ stock: e.target.value })} />
                <button type="button" aria-label="1つ増やす" onClick={() => set({ stock: String((Number(form.stock) || 0) + 1) })}>＋</button>
              </div>
            </Field>
            <fieldset className="afield">
              <legend className="afield-label">在庫が0個になったら</legend>
              <div className="segmented">
                {(['sold_out', 'made_to_order'] as const).map((w) => (
                  <label key={w} className={form.whenSoldOut === w ? 'on' : ''}>
                    <input type="radio" name="whenSoldOut" checked={form.whenSoldOut === w} onChange={() => set({ whenSoldOut: w })} />
                    {w === 'sold_out' ? '売り切れにする' : '受注生産に切り替える'}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <Field label="お届けまでの目安（日）" error={errors.leadDays} hint="お客さんには「約◯日でお届け」と表示されます">
          <input inputMode="numeric" value={form.leadDays} onChange={(e) => set({ leadDays: e.target.value })} />
        </Field>
        <Field label="送料表" error={errors.shippingTableId}>
          <select value={form.shippingTableId} onChange={(e) => set({ shippingTableId: e.target.value })}>
            <option value="">選んでください</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        {tables.length === 0 && (
          <p className="afield-hint">
            送料表がまだありません。先に<Link to="/admin/shipping/new">送料表を作って</Link>ください。
          </p>
        )}
      </section>

      <section className="aform-section">
        <h2>カテゴリ</h2>
        {categories.length === 0 && (
          <p className="afield-hint">カテゴリがまだありません。<Link to="/admin/categories">カテゴリを作る</Link></p>
        )}
        {grouped.map((g) => (
          <div key={g.group} className="afield">
            {g.group && <span className="afield-label">{g.group}</span>}
            <div className="chip-row wrap">
              {g.items.map((c) => {
                const on = form.categoryIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={on ? 'chip active' : 'chip'}
                    aria-pressed={on}
                    onClick={() => set({ categoryIds: on ? form.categoryIds.filter((x) => x !== c.id) : [...form.categoryIds, c.id] })}
                  >
                    {on ? '✓ ' : ''}{c.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="aform-section">
        <h2>商品の説明</h2>
        <p className="afield-hint">文字を選んで、キーボードの上のボタンで飾れます（太字・色・大きさ・マーカー・中央寄せ・箇条書き）</p>
        <RichTextEditor
          label="商品の説明"
          value={form.description}
          onChange={(description) => set({ description })}
          customColors={settings.customColors}
          onAddColor={(hex) => {
            if (settings.customColors.includes(hex)) return
            const next = { ...settings, customColors: [...settings.customColors, hex] }
            setSettings(next)
            data.saveSettings(next).catch(() => toast('色を登録できませんでした'))
          }}
        />
      </section>

      <QuestionsSection questions={form.questions} error={errors.questions} onChange={(questions) => set({ questions })} />

      {!form.isNew && (
        <section className="aform-section">
          <h2>この商品を消す</h2>
          <p className="afield-hint">お客さんに見せたくないだけなら、消さずに「お店に公開する」をオフにしてください。</p>
          <ConfirmButton
            label="商品を消す"
            confirmLabel="消す"
            message={`「${initial.name}」を消します。写真も消え、元に戻せません。`}
            onConfirm={async () => {
              try {
                const p = await data.getProduct(initial.id)
                if (p) await data.deleteProduct(p)
                changed()
                setDirty(false)
                tellDirty(false)
                toast('消しました')
                navigate('/admin')
              } catch {
                toast('消せませんでした。もう一度お試しください')
              }
            }}
          />
        </section>
      )}

      <div className="save-bar">
        <button type="button" className="secondary-button" onClick={() => leave('/admin')}>やめる</button>
        <button type="submit" className="buy-button" disabled={saving}>
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </form>
  )
}

function PhotosSection({
  photos,
  error,
  onChange,
  onRemove,
}: {
  photos: ProductForm['photos']
  error?: string
  onChange: (p: ProductForm['photos']) => void
  onRemove: (p: ProductForm['photos'][number]) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [problem, setProblem] = useState('')
  const left = MAX_PHOTOS - photos.length

  const add = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files).slice(0, left)
    setProblem(files.length > left ? `写真は${MAX_PHOTOS}枚までなので、${left}枚だけ追加しました` : '')
    setBusy(list.length)
    let next = photos
    for (const f of list) {
      try {
        const pending = await prepareImage(f)
        next = [...next, { key: tmpId('ph'), caption: '', pending }]
        onChange(next)
      } catch (e) {
        console.error(e)
        setProblem('読み込めない写真がありました（形式が対応していない可能性があります）')
      } finally {
        setBusy((n) => n - 1)
      }
    }
    if (input.current) input.current.value = ''
  }

  return (
    <section className={error ? 'aform-section has-error' : 'aform-section'}>
      <h2>写真（{photos.length}/{MAX_PHOTOS}）</h2>
      <p className="afield-hint">1枚目が一覧の表紙になります。保存するときに軽い形（WebP）にして送ります。</p>
      <ul className="photo-list">
        {photos.map((ph, i) => (
          <li key={ph.key} className="photo-item">
            <img src={ph.pending ? ph.pending.previewUrl : assetUrl(ph.existing!.thumbUrl)} alt={`写真${i + 1}`} />
            <div className="photo-controls">
              <span className="photo-no">{i === 0 ? '表紙' : `${i + 1}枚目`}</span>
              <input
                className="caption-input"
                aria-label={`写真${i + 1}の説明`}
                placeholder="写真の説明（なくてもOK）"
                value={ph.caption}
                onChange={(e) => onChange(photos.map((p) => (p.key === ph.key ? { ...p, caption: e.target.value } : p)))}
              />
              <div className="photo-buttons">
                <MoveButtons index={i} count={photos.length} name={`写真${i + 1}`} onMove={(a, b) => onChange(move(photos, a, b))} />
                <ConfirmButton
                  label="削除"
                  ariaLabel={`写真${i + 1}を削除`}
                  className="small-danger"
                  confirmLabel="削除する"
                  message={`写真${i + 1}を削除しますか？（「保存する」を押すまでは、「やめる」で元に戻せます）`}
                  onConfirm={() => {
                    onRemove(ph)
                    onChange(photos.filter((p) => p.key !== ph.key))
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {busy > 0 && <p className="afield-hint" aria-live="polite">写真を準備中…（あと{busy}枚）</p>}
      {problem && <p className="afield-error">{problem}</p>}
      {error && <p className="afield-error">{error}</p>}
      {left > 0 && (
        <label className="add-button">
          ＋ 写真を追加（カメラ・アルバム）
          <input ref={input} type="file" accept="image/*" multiple className="visually-hidden" onChange={(e) => add(e.target.files)} />
        </label>
      )}
    </section>
  )
}

function QuestionsSection({ questions, error, onChange }: { questions: QuestionDraft[]; error?: string; onChange: (q: QuestionDraft[]) => void }) {
  const update = (id: string, patch: Partial<QuestionDraft>) => onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  return (
    <section className={error ? 'aform-section has-error' : 'aform-section'}>
      <h2>買うときの質問</h2>
      <p className="afield-hint">例：「サイズ」（M／L +500円）、「名入れ」（あり +300円）、「鳥さんのお名前」（自由に入力）</p>
      {questions.map((q, qi) => (
        <div key={q.id} className="question-card">
          <div className="question-head">
            <span className="photo-no">質問{qi + 1}</span>
            <MoveButtons index={qi} count={questions.length} name={`質問${qi + 1}`} onMove={(a, b) => onChange(move(questions, a, b))} />
          </div>
          <ConfirmButton
            label="この質問を削除"
            ariaLabel={`質問${qi + 1}を削除`}
            className="small-danger"
            confirmLabel="削除する"
            message={`質問${qi + 1}${q.label ? `「${q.label}」` : ''}を、選択肢ごと削除しますか？`}
            onConfirm={() => onChange(questions.filter((x) => x.id !== q.id))}
          />
          <Field label="質問の文">
            <input value={q.label} onChange={(e) => update(q.id, { label: e.target.value })} placeholder="例：サイズ" />
          </Field>
          <div className="segmented">
            {(['choice', 'text'] as const).map((k) => (
              <label key={k} className={q.kind === k ? 'on' : ''}>
                <input type="radio" name={`kind-${q.id}`} checked={q.kind === k} onChange={() => update(q.id, { kind: k })} />
                {k === 'choice' ? '選択肢から選ぶ' : '自由に入力'}
              </label>
            ))}
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={q.required} onChange={(e) => update(q.id, { required: e.target.checked })} />
            <span>必ず答えてもらう（必須）</span>
          </label>
          {q.kind === 'choice' && (
            <div className="choices-edit">
              {q.choices.map((c, ci) => (
                <div key={c.id} className="choice-row">
                  <input
                    aria-label={`選択肢${ci + 1}の名前`}
                    placeholder="例：L"
                    value={c.label}
                    onChange={(e) => update(q.id, { choices: q.choices.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })}
                  />
                  <input
                    aria-label={`選択肢${ci + 1}の追加料金`}
                    className="extra-input"
                    inputMode="numeric"
                    placeholder="+0"
                    value={c.extra}
                    onChange={(e) => update(q.id, { choices: q.choices.map((x) => (x.id === c.id ? { ...x, extra: e.target.value } : x)) })}
                  />
                  <span className="unit">円</span>
                  <ConfirmButton
                    label="削除"
                    ariaLabel={`選択肢${ci + 1}を削除`}
                    className="small-danger"
                    confirmLabel="削除する"
                    message={`選択肢${ci + 1}${c.label ? `「${c.label}」` : ''}を削除しますか？`}
                    onConfirm={() => update(q.id, { choices: q.choices.filter((x) => x.id !== c.id) })}
                  />
                </div>
              ))}
              <button type="button" className="link-button" onClick={() => update(q.id, { choices: [...q.choices, { id: tmpId('c'), label: '', extra: '' }] })}>
                ＋ 選択肢を追加
              </button>
              <p className="afield-hint">追加料金：値段が変わらなければ空のまま。値引きはマイナス（例：-200）</p>
            </div>
          )}
        </div>
      ))}
      {error && <p className="afield-error">{error}</p>}
      <button
        type="button"
        className="add-button"
        onClick={() => onChange([...questions, { id: tmpId('q'), label: '', kind: 'choice', required: true, choices: [{ id: tmpId('c'), label: '', extra: '' }] }])}
      >
        ＋ 質問を追加
      </button>
    </section>
  )
}
