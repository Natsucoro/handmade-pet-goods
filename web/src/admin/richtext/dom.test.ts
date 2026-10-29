import type { RichBlock } from '@domain/types.ts'
import { parseBlocks, readSelection, renderBlocks, writeSelection } from './dom.ts'

const doc: RichBlock[] = [
  { type: 'paragraph', align: 'center', spans: [{ text: 'ふっくら' }, { text: 'つぼ巣', bold: true, color: 'pink', size: 'large' }] },
  { type: 'bullet', spans: [{ text: 'M サイズ', marker: true }] },
  { type: 'paragraph', spans: [{ text: '#色', color: '#123abc' }] },
]

function editor() {
  const el = document.createElement('div')
  document.body.append(el)
  return el
}

it('保存する形 → 画面 → 保存する形 で同じに戻る', () => {
  const el = editor()
  renderBlocks(el, doc)
  expect(parseBlocks(el)).toEqual(doc)
})

it('貼り付けなどで入った HTML は、決めた飾り以外を捨てる', () => {
  const el = editor()
  el.innerHTML =
    '<p>こんにちは<img src=x onerror="alert(1)"><a href="javascript:alert(1)">リンク</a></p>' +
    '<div><b>太字</b><span style="color:red; background:url(x)">赤</span><span data-c="red;x">色</span></div>' +
    '<ul><li>いち</li><li>に</li></ul><script>alert(1)</script>'
  const out = parseBlocks(el)
  expect(out).toEqual([
    { type: 'paragraph', spans: [{ text: 'こんにちは' }, { text: 'リンク' }] },
    { type: 'paragraph', spans: [{ text: '太字', bold: true }, { text: '赤' }, { text: '色' }] },
    { type: 'bullet', spans: [{ text: 'いち' }] },
    { type: 'bullet', spans: [{ text: 'に' }] },
    { type: 'paragraph', spans: [{ text: 'alert(1)' }] },
  ])
  expect(JSON.stringify(out)).not.toMatch(/onerror|javascript|url\(/)
})

it('選んだ範囲を、段落と文字の位置で読み書きできる', () => {
  const el = editor()
  renderBlocks(el, doc)
  writeSelection(el, { start: { block: 0, offset: 2 }, end: { block: 1, offset: 3 } })
  expect(window.getSelection()!.toString()).toBe('くらつぼ巣M サ')
  expect(readSelection(el)).toEqual({ start: { block: 0, offset: 2 }, end: { block: 1, offset: 3 } })
})

it('空の説明でも段落が1つある', () => {
  const el = editor()
  renderBlocks(el, [])
  expect(el.children).toHaveLength(1)
  expect(parseBlocks(el)).toEqual([{ type: 'paragraph', spans: [] }])
})
