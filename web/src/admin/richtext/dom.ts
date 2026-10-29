// 説明文の編集欄（contenteditable）と、保存する形（RichBlock）の行き来。
// 画面から読むときは、決めた飾りだけを拾う。それ以外（貼り付けられた HTML など）は文字だけにする。
import type { RichBlock, RichSpan } from '@domain/types.ts'
import { safeColor } from '../../lib/palette.ts'
import type { Pos, Sel, SpanStyle } from './model.ts'

const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL'])

/** 保存する形 → 編集欄の中身 */
export function renderBlocks(root: HTMLElement, blocks: RichBlock[]) {
  root.replaceChildren()
  const list = blocks.length ? blocks : [{ type: 'paragraph' as const, spans: [] }]
  for (const b of list) {
    const p = document.createElement('p')
    p.dataset.type = b.type
    if (b.align === 'center') p.dataset.align = 'center'
    for (const s of b.spans) {
      if (!s.text) continue
      const span = document.createElement('span')
      span.textContent = s.text
      if (s.bold) span.dataset.b = '1'
      if (s.marker) span.dataset.m = '1'
      if (s.size && s.size !== 'medium') span.dataset.s = s.size
      const color = safeColor(s.color)
      if (color && s.color) {
        span.dataset.c = s.color
        span.style.color = color
      }
      p.append(span)
    }
    if (!p.firstChild) p.append(document.createElement('br'))
    root.append(p)
  }
}

function styleOf(el: Element, inherited: SpanStyle): SpanStyle {
  const s = { ...inherited }
  if (!(el instanceof HTMLElement)) return s
  if (el.dataset.b || el.tagName === 'B' || el.tagName === 'STRONG') s.bold = true
  if (el.dataset.m) s.marker = true
  if (el.dataset.s === 'large' || el.dataset.s === 'small') s.size = el.dataset.s
  if (el.dataset.c && safeColor(el.dataset.c)) s.color = el.dataset.c
  return s
}

/** 編集欄の中身 → 保存する形（決めた飾り以外は捨てる） */
export function parseBlocks(root: HTMLElement): RichBlock[] {
  const blocks: RichBlock[] = []
  let current: RichBlock | null = null
  const startBlock = (el?: HTMLElement) => {
    current = { type: el?.dataset.type === 'bullet' || el?.tagName === 'LI' ? 'bullet' : 'paragraph', spans: [] }
    if (el?.dataset.align === 'center') current.align = 'center'
    blocks.push(current)
    return current
  }
  const pushText = (text: string, style: SpanStyle) => {
    if (!text) return
    const b = current ?? startBlock()
    b.spans.push({ ...style, text } as RichSpan)
  }
  const walk = (node: Node, style: SpanStyle, top: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText((node.textContent ?? '').replace(/\n/g, ''), style)
      return
    }
    if (!(node instanceof Element)) return
    if (node.tagName === 'BR') return
    if (BLOCK_TAGS.has(node.tagName) && (top || node.tagName === 'LI' || node.tagName === 'DIV' || node.tagName === 'P')) {
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        node.childNodes.forEach((c) => walk(c, style, true))
        current = null
        return
      }
      startBlock(node as HTMLElement)
      node.childNodes.forEach((c) => walk(c, styleOf(node, style), false))
      current = null
      return
    }
    node.childNodes.forEach((c) => walk(c, styleOf(node, style), false))
  }
  root.childNodes.forEach((c) => walk(c, {}, true))
  return blocks.length ? blocks : [{ type: 'paragraph', spans: [] }]
}

/** 編集欄の中の段落（一番上の段の要素）だけを並べる */
function topBlocks(root: HTMLElement): Element[] {
  return Array.from(root.children)
}

/** DOM の位置 → (段落番号, 文字の位置) */
export function domToPos(root: HTMLElement, node: Node, offset: number): Pos | null {
  const blocks = topBlocks(root)
  if (blocks.length === 0) return null
  if (node === root) {
    if (offset >= blocks.length) return { block: blocks.length - 1, offset: textLen(blocks[blocks.length - 1]) }
    return { block: offset, offset: 0 }
  }
  const blockIndex = blocks.findIndex((b) => b === node || b.contains(node))
  if (blockIndex < 0) return null
  // 段落の頭からその位置までの文字数を数える
  const r = document.createRange()
  r.setStart(blocks[blockIndex], 0)
  r.setEnd(node, offset)
  return { block: blockIndex, offset: Array.from(r.toString()).length }
}

function textLen(el: Element) {
  return Array.from(el.textContent ?? '').length
}

/** (段落番号, 文字の位置) → DOM の位置 */
export function posToDom(root: HTMLElement, pos: Pos): { node: Node; offset: number } | null {
  const block = topBlocks(root)[pos.block]
  if (!block) return null
  let remaining = pos.offset
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let t = walker.nextNode()
  let last: Node | null = null
  while (t) {
    const chars = Array.from(t.textContent ?? '')
    if (remaining <= chars.length) return { node: t, offset: chars.slice(0, remaining).join('').length }
    remaining -= chars.length
    last = t
    t = walker.nextNode()
  }
  if (last) return { node: last, offset: (last.textContent ?? '').length }
  return { node: block, offset: 0 }
}

export function readSelection(root: HTMLElement): Sel | null {
  const s = window.getSelection()
  if (!s || s.rangeCount === 0) return null
  const r = s.getRangeAt(0)
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null
  const start = domToPos(root, r.startContainer, r.startOffset)
  const end = domToPos(root, r.endContainer, r.endOffset)
  if (!start || !end) return null
  return { start, end }
}

export function writeSelection(root: HTMLElement, sel: Sel) {
  const a = posToDom(root, sel.start)
  const b = posToDom(root, sel.end)
  const s = window.getSelection()
  if (!a || !b || !s) return
  const r = document.createRange()
  r.setStart(a.node, a.offset)
  r.setEnd(b.node, b.offset)
  s.removeAllRanges()
  s.addRange(r)
}
