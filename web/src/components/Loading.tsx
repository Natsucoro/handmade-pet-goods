// 読み込み中の表示。ぱっと切り替わらないように、形だけ先に見せる（スケルトン）。

/** ぴょんぴょん跳ねる文鳥 */
export function BirdLoader({ label = '読み込み中' }: { label?: string }) {
  return (
    <div className="bird-loader" role="status" aria-label={label}>
      <svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true">
        <ellipse className="bird-shadow" cx="32" cy="45" rx="14" ry="2.5" />
        <g className="bird">
          <ellipse cx="34" cy="26" rx="17" ry="13" fill="#fff" stroke="#d9c4b8" strokeWidth="2" />
          <circle cx="22" cy="17" r="10" fill="#fff" stroke="#d9c4b8" strokeWidth="2" />
          <circle cx="19" cy="15" r="2.4" fill="#3d3330" />
          <circle cx="19" cy="15" r="4" fill="none" stroke="#e8789a" strokeWidth="1.6" />
          <path d="M12 17 q-7 1.5 -7 4 q4 1 9 -1z" fill="#e8546f" />
          <path d="M49 28 l12 4 -12 3z" fill="#e9e3dd" />
        </g>
      </svg>
      <span className="bird-loader-text">
        読み込み中<span className="dots"><i>.</i><i>.</i><i>.</i></span>
      </span>
    </div>
  )
}

/** お店の商品一覧の形 */
export function ProductGridSkeleton() {
  return (
    <div className="catalog" role="status" aria-label="読み込み中">
      <div className="sk sk-search" />
      <div className="sk-row">
        {[64, 88, 72, 96].map((w, i) => (
          <div key={i} className="sk sk-chip" style={{ width: w }} />
        ))}
      </div>
      <ul className="product-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="card sk-card">
            <div className="sk sk-photo" />
            <div className="card-body">
              <div className="sk sk-line" />
              <div className="sk sk-line short" />
              <div className="sk sk-pill" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 商品ページの形 */
export function ProductPageSkeleton() {
  return (
    <div className="product" role="status" aria-label="読み込み中">
      <div className="sk sk-back" />
      <div className="sk sk-hero" />
      <div className="sk sk-line wide" />
      <div className="sk sk-line short" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="sk sk-panel" />
      ))}
    </div>
  )
}

/** 管理画面の一覧の形 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="読み込み中">
      <div className="sk sk-line title" />
      <ul className="admin-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="admin-item">
            <div className="admin-item-row">
              <div className="sk sk-thumb" />
              <div className="sk-col">
                <div className="sk sk-line" />
                <div className="sk sk-line short" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 管理画面の入力画面の形 */
export function FormSkeleton() {
  return (
    <div className="product-form" role="status" aria-label="読み込み中">
      <div className="sk sk-line title" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="sk sk-panel tall" />
      ))}
    </div>
  )
}
