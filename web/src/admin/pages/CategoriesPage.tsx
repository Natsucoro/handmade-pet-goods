import type { Category } from '@domain/types.ts'
import { useEffect, useState } from 'react'
import { useAdmin } from '../AdminContext.tsx'
import { tmpId } from '../productForm.ts'
import { ConfirmButton, Field, MoveButtons } from '../ui.tsx'
import { move } from '../util.ts'

export function CategoriesPage() {
  const { data, changed, toast } = useAdmin()
  const [list, setList] = useState<Category[] | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [sorting, setSorting] = useState(false)

  const reload = () => data.listCategories().then(setList)
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  if (!list) return <p className="status">読み込み中…</p>
  const groups = Array.from(new Set(list.map((c) => c.group).filter(Boolean)))

  const saveOrder = async () => {
    try {
      await data.saveCategoryOrder(list.map((c) => c.id))
      changed()
      toast('並び順を保存しました')
      setSorting(false)
    } catch {
      toast('保存できませんでした')
    }
  }

  return (
    <section>
      <div className="admin-page-head">
        <h1>カテゴリ（{list.length}）</h1>
        {!sorting && list.length > 1 && (
          <button type="button" className="secondary-button small" onClick={() => setSorting(true)}>
            並べ替え
          </button>
        )}
      </div>
      <p className="afield-hint">
        お店の一覧の上にボタンとして並びます。「まとまり」が同じものは同じ行に並びます（例：アニマル＝文鳥・オカメインコ、カテゴリ＝巣・おもちゃ）。
      </p>

      {editing && !list.some((c) => c.id === editing.id) && (
        <CategoryForm
          value={editing}
          groups={groups}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      {!editing && !sorting && (
        <button
          type="button"
          className="add-button"
          onClick={() => setEditing({ id: tmpId('cat-'), name: '', group: groups[0] ?? '', sortOrder: (list.at(-1)?.sortOrder ?? 0) + 1 })}
        >
          ＋ カテゴリを追加
        </button>
      )}

      <ul className="admin-list">
        {list.map((c, i) =>
          editing?.id === c.id ? (
            <li key={c.id} className="admin-item">
              <CategoryForm
                value={editing}
                groups={groups}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null)
                  reload()
                }}
              />
            </li>
          ) : (
            <li key={c.id} className="admin-item">
              <div className="admin-item-row">
                <span className="admin-item-body">
                  <span className="admin-item-name">{c.name}</span>
                  <span className="admin-item-meta">{c.group || 'まとまりなし'}</span>
                </span>
                {sorting ? (
                  <MoveButtons index={i} count={list.length} name={c.name} onMove={(a, b) => setList(move(list, a, b))} />
                ) : (
                  <button type="button" className="secondary-button small" onClick={() => setEditing(c)}>
                    直す
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>

      {sorting && (
        <div className="save-bar">
          <button type="button" className="secondary-button" onClick={() => { setSorting(false); reload() }}>
            やめる
          </button>
          <button type="button" className="buy-button" onClick={saveOrder}>
            並び順を保存
          </button>
        </div>
      )}
    </section>
  )
}

function CategoryForm({ value, groups, onCancel, onSaved }: { value: Category; groups: string[]; onCancel: () => void; onSaved: () => void }) {
  const { data, changed, toast } = useAdmin()
  const [name, setName] = useState(value.name)
  const [group, setGroup] = useState(value.group)
  const [error, setError] = useState('')
  const isNew = value.name === ''

  const save = async () => {
    if (!name.trim()) return setError('名前を入れてください')
    try {
      await data.saveCategory({ ...value, name: name.trim(), group: group.trim() })
      changed()
      toast('保存しました')
      onSaved()
    } catch {
      toast('保存できませんでした')
    }
  }

  return (
    <div className="inline-form">
      <Field label="カテゴリの名前" error={error}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：文鳥" autoFocus />
      </Field>
      <Field label="まとまり" hint="同じまとまりは同じ行に並びます。新しいまとまりは名前を入れるだけ">
        <input value={group} onChange={(e) => setGroup(e.target.value)} list="category-groups" placeholder="例：アニマル" />
        <datalist id="category-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </Field>
      {groups.length > 0 && (
        <div className="chip-row wrap">
          {groups.map((g) => (
            <button key={g} type="button" className={g === group ? 'chip small active' : 'chip small'} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
      )}
      <div className="inline-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>やめる</button>
        <button type="button" className="buy-button" onClick={save}>保存する</button>
      </div>
      {!isNew && (
        <ConfirmButton
          label="このカテゴリを消す"
          confirmLabel="消す"
          message={`「${value.name}」を消します。商品は消えず、このカテゴリから外れるだけです。`}
          onConfirm={async () => {
            try {
              await data.deleteCategory(value.id)
              changed()
              toast('消しました')
              onSaved()
            } catch {
              toast('消せませんでした')
            }
          }}
        />
      )}
    </div>
  )
}
