import type { RichBlock } from '@domain/types.ts'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PALETTE } from '../../lib/palette.ts'
import { parseBlocks, readSelection, renderBlocks, writeSelection } from './dom.ts'
import { applyStyle, isCollapsed, selectionHas, toggleBullet, toggleCenter, type Sel, type StyleChange } from './model.ts'

const PALETTE_NAMES: Record<string, string> = {
  pink: 'ピンク', coral: 'コーラル', lemon: 'レモン', mint: 'ミント', sky: 'そら', lavender: 'ラベンダー', brown: 'ブラウン',
}

/**
 * 説明文の編集欄。文字を選んでから、キーボードの上の飾りボタンを押す。
 * 保存するのは決めた飾りだけ（HTML は保存しない）。
 */
export function RichTextEditor({
  value,
  onChange,
  customColors,
  onAddColor,
  label,
}: {
  value: RichBlock[]
  onChange: (blocks: RichBlock[]) => void
  customColors: string[]
  onAddColor: (hex: string) => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const blocks = useRef<RichBlock[]>(value)
  const lastSel = useRef<Sel | null>(null)
  const [focused, setFocused] = useState(false)
  const [popup, setPopup] = useState<null | 'color' | 'size'>(null)
  const [, force] = useState(0)
  const bottom = useKeyboardOffset(focused)

  // 最初の1回だけ中身を描く（入力中に描き直すとカーソルが飛ぶため）
  useLayoutEffect(() => {
    if (ref.current) renderBlocks(ref.current, value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onSel = () => {
      if (!ref.current) return
      const s = readSelection(ref.current)
      if (s) {
        lastSel.current = s
        force((n) => n + 1)
      }
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const sync = () => {
    const el = ref.current
    if (!el) return
    // 段落の外に文字が入ったとき（空の欄に打ち始めたときなど）は、段落に入れ直す
    const stray = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE || (n instanceof Element && n.tagName !== 'P'))
    const sel = readSelection(el)
    blocks.current = parseBlocks(el)
    if (stray) {
      renderBlocks(el, blocks.current)
      if (sel) writeSelection(el, sel)
    }
    onChange(blocks.current)
  }

  const apply = (fn: (b: RichBlock[], s: Sel) => RichBlock[]) => {
    const el = ref.current
    const sel = lastSel.current
    if (!el || !sel) return
    blocks.current = fn(parseBlocks(el), sel)
    renderBlocks(el, blocks.current)
    el.focus()
    writeSelection(el, sel)
    onChange(blocks.current)
    setPopup(null)
  }
  const style = (change: StyleChange) => apply((b, s) => applyStyle(b, s, change))

  // ボタンを押しても編集欄からフォーカスを外さない（選んだ範囲が消えないように）
  const keep = (e: ReactPointerEvent) => e.preventDefault()
  const sel = lastSel.current
  const hasRange = !!sel && !isCollapsed(sel)
  const current = parseBlocksSafe(ref.current)
  const boldOn = hasRange && sel ? selectionHas(current, sel, 'bold') : false
  const markerOn = hasRange && sel ? selectionHas(current, sel, 'marker') : false

  return (
    <div className="rte">
      <div
        ref={ref}
        className="rte-area rich-text"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onInput={sync}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          // 色を選ぶ画面などツールバーの中に移っただけなら閉じない
          if (toolbarRef.current?.contains(e.relatedTarget as Node | null)) return
          setFocused(false)
          setPopup(null)
        }}
        onPaste={(e) => {
          // 貼り付けは文字だけにする（よそのページの飾りや仕掛けを持ち込まない）
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, text)
        }}
      />
      {focused && (
        <div className="rte-toolbar" ref={toolbarRef} style={{ bottom }} role="toolbar" aria-label="文字の飾り">
          {popup === 'color' && (
            <div className="rte-popup" onPointerDown={keep}>
              <button type="button" className="swatch none" aria-label="色なし" onClick={() => style({ kind: 'color', color: null })}>
                なし
              </button>
              {Object.entries(PALETTE).map(([name, hex]) => (
                <button
                  key={name}
                  type="button"
                  className="swatch"
                  style={{ background: hex }}
                  aria-label={PALETTE_NAMES[name] ?? name}
                  onClick={() => style({ kind: 'color', color: name })}
                />
              ))}
              {customColors.map((hex) => (
                <button key={hex} type="button" className="swatch" style={{ background: hex }} aria-label={`登録した色 ${hex}`} onClick={() => style({ kind: 'color', color: hex })} />
              ))}
              <label className="swatch add" aria-label="色を登録" onPointerDown={(e) => e.stopPropagation()}>
                ＋
                <input
                  type="color"
                  onChange={(e) => {
                    onAddColor(e.target.value)
                    style({ kind: 'color', color: e.target.value })
                  }}
                  onBlur={() => ref.current?.focus()}
                />
              </label>
            </div>
          )}
          {popup === 'size' && (
            <div className="rte-popup" onPointerDown={keep}>
              <button type="button" className="tb" onClick={() => style({ kind: 'size', size: 'large' })}>大</button>
              <button type="button" className="tb" onClick={() => style({ kind: 'size', size: 'medium' })}>中</button>
              <button type="button" className="tb" onClick={() => style({ kind: 'size', size: 'small' })}>小</button>
            </div>
          )}
          <div className="rte-buttons" onPointerDown={keep}>
            <button type="button" className={boldOn ? 'tb on' : 'tb'} aria-pressed={boldOn} disabled={!hasRange} onClick={() => style({ kind: 'toggle', key: 'bold' })}>
              <b>太</b>
            </button>
            <button type="button" className={popup === 'color' ? 'tb on' : 'tb'} disabled={!hasRange} onClick={() => setPopup(popup === 'color' ? null : 'color')}>
              色
            </button>
            <button type="button" className={popup === 'size' ? 'tb on' : 'tb'} disabled={!hasRange} onClick={() => setPopup(popup === 'size' ? null : 'size')}>
              大小
            </button>
            <button type="button" className={markerOn ? 'tb on' : 'tb'} aria-pressed={markerOn} disabled={!hasRange} onClick={() => style({ kind: 'toggle', key: 'marker' })}>
              <span className="rt-marker">マ</span>
            </button>
            <button type="button" className="tb" disabled={!sel} onClick={() => apply(toggleCenter)} aria-label="中央寄せ">
              中央
            </button>
            <button type="button" className="tb" disabled={!sel} onClick={() => apply(toggleBullet)} aria-label="箇条書き">
              ・箇条
            </button>
          </div>
          {!hasRange && <p className="rte-hint">文字を選ぶと、太字・色・大きさ・マーカーが使えます</p>}
        </div>
      )}
    </div>
  )
}

function parseBlocksSafe(el: HTMLElement | null): RichBlock[] {
  return el ? parseBlocks(el) : []
}

/** スマホのキーボードが出ているとき、その上にボタンを出すための位置 */
function useKeyboardOffset(active: boolean): number {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const update = () => setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])
  return offset
}
