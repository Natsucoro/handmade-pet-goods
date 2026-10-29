import { useEffect, useState, type ReactNode } from 'react'

/** 消すなどの取り消せない操作は、もう一度押して確かめる（ブラウザの確認画面は使わない） */
export function ConfirmButton({
  label,
  confirmLabel,
  message,
  onConfirm,
  className = 'danger-button',
  ariaLabel,
}: {
  label: string
  confirmLabel: string
  message: string
  onConfirm: () => void | Promise<void>
  className?: string
  ariaLabel?: string
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!asking) {
    return (
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }
  return (
    <div className="confirm-box" role="alertdialog" aria-label={message}>
      <p>{message}</p>
      <div className="confirm-actions">
        <button type="button" className="secondary-button" onClick={() => setAsking(false)} disabled={busy}>
          やめる
        </button>
        <button
          type="button"
          className="danger-button solid"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm()
            } finally {
              setBusy(false)
              setAsking(false)
            }
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [message, onDone])
  if (!message) return null
  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string }) {
  return (
    <label className={error ? 'afield has-error' : 'afield'}>
      <span className="afield-label">{label}</span>
      {children}
      {hint && !error && <span className="afield-hint">{hint}</span>}
      {error && <span className="afield-error">{error}</span>}
    </label>
  )
}

/** 上下ボタンで並べ替える（スマホで指で引きずるのは誤操作が多いので、ボタンにする） */
export function MoveButtons({ index, count, onMove, name }: { index: number; count: number; onMove: (from: number, to: number) => void; name: string }) {
  return (
    <span className="move-buttons">
      <button type="button" aria-label={`${name}を上へ`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        ▲
      </button>
      <button type="button" aria-label={`${name}を下へ`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
        ▼
      </button>
    </span>
  )
}
