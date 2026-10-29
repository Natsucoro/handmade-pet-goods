// 商品の編集フォームの中身と、保存する形との行き来・入力チェック。
import type { Product, Question, RichBlock, StockType, WhenSoldOut } from '@domain/types.ts'
import type { PhotoDraft } from './AdminData.ts'
import { MAX_PHOTOS } from './images.ts'
import { normalizeBlocks } from './richtext/model.ts'
import { toInt } from './util.ts'

export interface ChoiceDraft { id: string; label: string; extra: string }
export interface QuestionDraft { id: string; label: string; kind: 'text' | 'choice'; required: boolean; choices: ChoiceDraft[] }

export interface ProductForm {
  id: string
  isNew: boolean
  name: string
  price: string
  published: boolean
  stockType: StockType
  stock: string
  whenSoldOut: WhenSoldOut
  leadDays: string
  shippingTableId: string
  categoryIds: string[]
  description: RichBlock[]
  questions: QuestionDraft[]
  photos: PhotoDraft[]
  createdAtMs: number
  sortOrder: number
}

export type FormErrors = Partial<Record<'name' | 'price' | 'stock' | 'leadDays' | 'shippingTableId' | 'photos' | 'questions', string>>

let seq = 0
export const tmpId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

export function emptyForm(id: string, sortOrder: number, shippingTableId = ''): ProductForm {
  return {
    id,
    isNew: true,
    name: '',
    price: '',
    published: false,
    stockType: 'stock',
    stock: '1',
    whenSoldOut: 'sold_out',
    leadDays: '7',
    shippingTableId,
    categoryIds: [],
    description: [],
    questions: [],
    photos: [],
    createdAtMs: Date.now(),
    sortOrder,
  }
}

export function formFromProduct(p: Product): ProductForm {
  return {
    id: p.id,
    isNew: false,
    name: p.name,
    price: String(p.basePrice),
    published: p.published,
    stockType: p.stockType,
    stock: String(p.stock),
    whenSoldOut: p.whenSoldOut,
    leadDays: String(p.leadDays),
    shippingTableId: p.shippingTableId,
    categoryIds: [...p.categoryIds],
    description: p.description,
    questions: p.questions.map((q) => ({
      id: q.id,
      label: q.label,
      kind: q.kind,
      required: q.required,
      choices: (q.choices ?? []).map((c) => ({ id: c.id, label: c.label, extra: String(c.extraPrice) })),
    })),
    photos: p.photos.map((ph, i) => ({ key: `existing-${i}`, caption: ph.caption, existing: ph })),
    createdAtMs: p.createdAtMs,
    sortOrder: p.sortOrder,
  }
}

/** 入力をチェックして、保存する形にする。おかしいところがあれば errors に入れる */
export function formToProduct(f: ProductForm): { product?: Omit<Product, 'photos'>; errors: FormErrors } {
  const errors: FormErrors = {}
  const name = f.name.trim()
  if (!name) errors.name = '商品名を入れてください'
  const price = toInt(f.price)
  if (price === null || price < 0) errors.price = '値段を数字で入れてください（例：3000）'
  const stock = toInt(f.stock)
  if (f.stockType === 'stock' && (stock === null || stock < 0)) errors.stock = '在庫数を0以上の数字で入れてください'
  const leadDays = toInt(f.leadDays)
  if (leadDays === null || leadDays < 0) errors.leadDays = '日数を0以上の数字で入れてください'
  if (!f.shippingTableId) errors.shippingTableId = '送料表を選んでください'
  if (f.photos.length > MAX_PHOTOS) errors.photos = `写真は${MAX_PHOTOS}枚までです`

  const questions: Question[] = []
  for (const q of f.questions) {
    const label = q.label.trim()
    if (!label) {
      errors.questions = '質問の文が空のものがあります'
      continue
    }
    if (q.kind === 'text') {
      questions.push({ id: q.id, label, kind: 'text', required: q.required })
      continue
    }
    const choices = []
    for (const c of q.choices) {
      const cl = c.label.trim()
      const extra = c.extra.trim() === '' ? 0 : toInt(c.extra)
      if (!cl) errors.questions = `「${label}」に名前が空の選択肢があります`
      else if (extra === null) errors.questions = `「${label}」の「${cl}」の追加料金を数字で入れてください（値引きはマイナス）`
      else choices.push({ id: c.id, label: cl, extraPrice: extra })
    }
    if (q.choices.length === 0) errors.questions = `「${label}」に選択肢を1つ以上入れてください`
    questions.push({ id: q.id, label, kind: 'choice', required: q.required, choices })
  }

  if (Object.keys(errors).length > 0) return { errors }
  return {
    errors,
    product: {
      id: f.id,
      name,
      basePrice: price!,
      published: f.published,
      stockType: f.stockType,
      stock: f.stockType === 'stock' ? stock! : 0,
      whenSoldOut: f.whenSoldOut,
      leadDays: leadDays!,
      shippingTableId: f.shippingTableId,
      categoryIds: f.categoryIds,
      description: normalizeBlocks(f.description),
      questions,
      createdAtMs: f.createdAtMs,
      sortOrder: f.sortOrder,
    },
  }
}
