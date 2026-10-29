import type { RichBlock } from '@domain/types.ts'
import { applyStyle, blocksFromPlainText, normalizeBlocks, selectionHas, toggleBullet, toggleCenter } from './model.ts'

const doc: RichBlock[] = [
  { type: 'paragraph', spans: [{ text: 'ふっくら' }, { text: 'つぼ巣', bold: true }] },
  { type: 'paragraph', spans: [{ text: '手編みです' }] },
]
const sel = (b1: number, o1: number, b2: number, o2: number) => ({ start: { block: b1, offset: o1 }, end: { block: b2, offset: o2 } })

describe('飾りを付ける・外す', () => {
  it('選んだ文字だけ太字にする', () => {
    const out = applyStyle(doc, sel(1, 0, 1, 2), { kind: 'toggle', key: 'bold' })
    expect(out[1].spans).toEqual([{ text: '手編', bold: true }, { text: 'みです' }])
    expect(out[0]).toBe(doc[0])
  })
  it('全部太字なら外す、一部だけなら全部太字にする', () => {
    expect(applyStyle(doc, sel(0, 4, 0, 7), { kind: 'toggle', key: 'bold' })[0].spans).toEqual([{ text: 'ふっくらつぼ巣' }])
    expect(applyStyle(doc, sel(0, 2, 0, 7), { kind: 'toggle', key: 'bold' })[0].spans).toEqual([
      { text: 'ふっ' },
      { text: 'くらつぼ巣', bold: true },
    ])
  })
  it('段落をまたいで色を付ける・「色なし」で外す', () => {
    const colored = applyStyle(doc, sel(0, 4, 1, 1), { kind: 'color', color: 'pink' })
    expect(colored[0].spans).toEqual([{ text: 'ふっくら' }, { text: 'つぼ巣', bold: true, color: 'pink' }])
    expect(colored[1].spans).toEqual([{ text: '手', color: 'pink' }, { text: '編みです' }])
    expect(applyStyle(colored, sel(1, 0, 1, 1), { kind: 'color', color: null })[1].spans).toEqual([{ text: '手編みです' }])
  })
  it('大きさ（中に戻すと飾りなし）とマーカー', () => {
    const big = applyStyle(doc, sel(1, 0, 1, 5), { kind: 'size', size: 'large' })
    expect(big[1].spans).toEqual([{ text: '手編みです', size: 'large' }])
    expect(applyStyle(big, sel(1, 0, 1, 5), { kind: 'size', size: 'medium' })[1].spans).toEqual([{ text: '手編みです' }])
    const m = applyStyle(doc, sel(1, 0, 1, 2), { kind: 'toggle', key: 'marker' })
    expect(selectionHas(m, sel(1, 0, 1, 2), 'marker')).toBe(true)
    expect(selectionHas(m, sel(1, 0, 1, 3), 'marker')).toBe(false)
  })
  it('カーソルだけ（何も選んでいない）なら何も変えない', () => {
    expect(applyStyle(doc, sel(0, 1, 0, 1), { kind: 'toggle', key: 'bold' })).toBe(doc)
  })
  it('絵文字も1文字として数える', () => {
    const d: RichBlock[] = [{ type: 'paragraph', spans: [{ text: '🐦かわいい' }] }]
    expect(applyStyle(d, sel(0, 0, 0, 1), { kind: 'toggle', key: 'bold' })[0].spans).toEqual([
      { text: '🐦', bold: true },
      { text: 'かわいい' },
    ])
  })
})

describe('段落の切り替え', () => {
  it('箇条書き', () => {
    const b = toggleBullet(doc, sel(0, 0, 1, 0))
    expect(b.map((x) => x.type)).toEqual(['bullet', 'bullet'])
    expect(toggleBullet(b, sel(0, 0, 1, 0)).map((x) => x.type)).toEqual(['paragraph', 'paragraph'])
  })
  it('中央寄せ', () => {
    const c = toggleCenter(doc, sel(1, 0, 1, 0))
    expect(c[1].align).toBe('center')
    expect(toggleCenter(c, sel(1, 0, 1, 0))[1].align).toBeUndefined()
  })
})

it('保存前に整える（最後の空の段落を落とし、同じ飾りの続きはまとめる）', () => {
  expect(
    normalizeBlocks([
      { type: 'paragraph', spans: [{ text: 'あ', bold: true }, { text: 'い', bold: true }, { text: '' }] },
      { type: 'paragraph', spans: [] },
    ]),
  ).toEqual([{ type: 'paragraph', spans: [{ text: 'あい', bold: true }] }])
})

it('ふつうの文章から作る', () => {
  expect(blocksFromPlainText('一行目\n\n三行目').map((b) => b.spans.map((s) => s.text).join(''))).toEqual(['一行目', '', '三行目'])
})
