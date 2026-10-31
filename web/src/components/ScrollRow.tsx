import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'

/**
 * 横にスライドできる列。続きがある側をぼかし、「›」「‹」のボタンを出す。
 * 最初に出たときは、1回だけ少し右に動いて戻る（スライドできる合図）。
 */
export function ScrollRow({
  as = 'div',
  className = '',
  children,
  hintKey,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'ul'; children: ReactNode; hintKey?: string }) {
  const ref = useRef<HTMLDivElement & HTMLUListElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = () => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useLayoutEffect(() => {
    update()
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // スライドできる合図（同じ列では、ページを開いている間に1回だけ）
  useEffect(() => {
    const el = ref.current
    if (!el || !hintKey || el.scrollWidth <= el.clientWidth + 4) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    try {
      const k = `scroll-hint:${hintKey}`
      if (sessionStorage.getItem(k)) return
      sessionStorage.setItem(k, '1')
    } catch {
      // 覚えておけなくても、合図は出す
    }
    const t1 = setTimeout(() => el.scrollBy?.({ left: 48, behavior: 'smooth' }), 800)
    const t2 = setTimeout(() => el.scrollBy?.({ left: -48, behavior: 'smooth' }), 1350)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [hintKey])

  const step = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy?.({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }
  const Tag = as

  return (
    <div className={`scroll-wrap${canLeft ? ' can-left' : ''}${canRight ? ' can-right' : ''}`}>
      <Tag ref={ref} className={`scroll-row ${className}`} onScroll={update} {...rest}>
        {children}
      </Tag>
      {canLeft && (
        <button type="button" className="scroll-btn left" aria-label="左に戻す" tabIndex={-1} onPointerDown={(e) => e.preventDefault()} onClick={() => step(-1)}>
          ‹
        </button>
      )}
      {canRight && (
        <button type="button" className="scroll-btn right" aria-label="右にまだあります" tabIndex={-1} onPointerDown={(e) => e.preventDefault()} onClick={() => step(1)}>
          ›
        </button>
      )}
    </div>
  )
}
