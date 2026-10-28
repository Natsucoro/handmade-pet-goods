import type { RichBlock, RichSpan } from '@domain/types.ts'
import type { CSSProperties, ReactNode } from 'react'
import { safeColor } from '../lib/palette.ts'

// 説明文を表示する。文字はすべて React の普通の文字として出すので、
// 説明文に <script> などが書かれていても、ただの文字として表示されるだけ。

function Span({ span }: { span: RichSpan }) {
  const style: CSSProperties = {}
  const color = safeColor(span.color)
  if (color) style.color = color
  const className = [
    span.size ? `rt-${span.size}` : '',
    span.marker ? 'rt-marker' : '',
  ].filter(Boolean).join(' ') || undefined
  const content = span.bold ? <strong>{span.text}</strong> : span.text
  return <span className={className} style={style}>{content}</span>
}

function spans(block: RichBlock) {
  return block.spans.map((s, i) => <Span key={i} span={s} />)
}

export function RichText({ blocks }: { blocks: RichBlock[] }) {
  const out: ReactNode[] = []
  let bullets: RichBlock[] = []
  const flush = () => {
    if (bullets.length === 0) return
    out.push(
      <ul key={`ul-${out.length}`}>
        {bullets.map((b, i) => (
          <li key={i} className={b.align === 'center' ? 'rt-center' : undefined}>{spans(b)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }
  for (const block of blocks) {
    if (block.type === 'bullet') {
      bullets.push(block)
      continue
    }
    flush()
    out.push(
      <p key={`p-${out.length}`} className={block.align === 'center' ? 'rt-center' : undefined}>
        {spans(block)}
      </p>,
    )
  }
  flush()
  return <div className="rich-text">{out}</div>
}
