// 説明文の飾りの計算（画面に関係しない部分）。
// 選んだ文字の範囲に、太字・色・大きさ・マーカーを付けたり外したりする。
import type { RichBlock, RichSpan } from '@domain/types.ts'

export type SpanStyle = Omit<RichSpan, 'text'>
export interface Pos { block: number; offset: number }
export interface Sel { start: Pos; end: Pos }

type Char = { ch: string; style: SpanStyle }

const clean = (s: SpanStyle): SpanStyle => {
  const out: SpanStyle = {}
  if (s.bold) out.bold = true
  if (s.color) out.color = s.color
  if (s.size && s.size !== 'medium') out.size = s.size
  if (s.marker) out.marker = true
  return out
}
const same = (a: SpanStyle, b: SpanStyle) =>
  !!a.bold === !!b.bold && (a.color ?? '') === (b.color ?? '') && (a.size ?? '') === (b.size ?? '') && !!a.marker === !!b.marker

function toChars(b: RichBlock): Char[] {
  return b.spans.flatMap((s) => Array.from(s.text).map((ch) => ({ ch, style: clean(s) })))
}

function fromChars(chars: Char[]): RichSpan[] {
  const spans: RichSpan[] = []
  for (const c of chars) {
    const last = spans[spans.length - 1]
    if (last && same(last, c.style)) last.text += c.ch
    else spans.push({ ...c.style, text: c.ch })
  }
  return spans
}

export function blockLength(b: RichBlock): number {
  return b.spans.reduce((n, s) => n + Array.from(s.text).length, 0)
}

export function blockText(b: RichBlock): string {
  return b.spans.map((s) => s.text).join('')
}

/** 空の範囲（カーソルだけ）でないか */
export function isCollapsed(sel: Sel): boolean {
  return sel.start.block === sel.end.block && sel.start.offset === sel.end.offset
}

function eachSelected(blocks: RichBlock[], sel: Sel, fn: (c: Char) => void): Char[][] {
  const all = blocks.map(toChars)
  for (let b = sel.start.block; b <= sel.end.block; b++) {
    const from = b === sel.start.block ? sel.start.offset : 0
    const to = b === sel.end.block ? sel.end.offset : all[b].length
    for (let i = from; i < to; i++) fn(all[b][i])
  }
  return all
}

/** 選んだ文字が全部その飾りを持っているか（ボタンを「押された状態」で見せるため） */
export function selectionHas(blocks: RichBlock[], sel: Sel, key: 'bold' | 'marker'): boolean {
  let any = false
  let all = true
  eachSelected(blocks, sel, (c) => {
    any = true
    if (!c.style[key]) all = false
  })
  return any && all
}

export type StyleChange =
  | { kind: 'toggle'; key: 'bold' | 'marker' }
  | { kind: 'color'; color: string | null }
  | { kind: 'size'; size: 'large' | 'medium' | 'small' }

/** 選んだ範囲に飾りを付ける／外す。太字とマーカーは、全部付いていれば外し、そうでなければ付ける */
export function applyStyle(blocks: RichBlock[], sel: Sel, change: StyleChange): RichBlock[] {
  if (isCollapsed(sel)) return blocks
  const turnOn = change.kind === 'toggle' ? !selectionHas(blocks, sel, change.key) : true
  const all = eachSelected(blocks, sel, (c) => {
    if (change.kind === 'toggle') c.style = clean({ ...c.style, [change.key]: turnOn })
    else if (change.kind === 'color') c.style = clean({ ...c.style, color: change.color ?? undefined })
    else c.style = clean({ ...c.style, size: change.size })
  })
  return blocks.map((b, i) => (i >= sel.start.block && i <= sel.end.block ? { ...b, spans: fromChars(all[i]) } : b))
}

/** 選んだ段落を、箇条書き⇔ふつうの段落に切り替える（全部が箇条書きならふつうに戻す） */
export function toggleBullet(blocks: RichBlock[], sel: Sel): RichBlock[] {
  const range = blocks.slice(sel.start.block, sel.end.block + 1)
  const allBullet = range.every((b) => b.type === 'bullet')
  return blocks.map((b, i) =>
    i >= sel.start.block && i <= sel.end.block ? { ...b, type: allBullet ? 'paragraph' : 'bullet' } : b,
  )
}

/** 選んだ段落を、中央寄せ⇔左寄せに切り替える */
export function toggleCenter(blocks: RichBlock[], sel: Sel): RichBlock[] {
  const range = blocks.slice(sel.start.block, sel.end.block + 1)
  const allCenter = range.every((b) => b.align === 'center')
  return blocks.map((b, i) => {
    if (i < sel.start.block || i > sel.end.block) return b
    const { align: _drop, ...rest } = b
    void _drop
    return allCenter ? rest : { ...rest, align: 'center' }
  })
}

/** 保存する前に整える：空の飾り・空の文字を取り除き、最後の空の段落を落とす */
export function normalizeBlocks(blocks: RichBlock[]): RichBlock[] {
  const out = blocks.map((b) => ({ ...b, spans: fromChars(toChars(b)) }))
  while (out.length > 0 && blockLength(out[out.length - 1]) === 0) out.pop()
  return out
}

/** ふつうの文章（改行で段落を分ける）から作る */
export function blocksFromPlainText(text: string): RichBlock[] {
  return text.split(/\r?\n/).map((line) => ({ type: 'paragraph' as const, spans: line ? [{ text: line }] : [] }))
}
