import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="status">
      <p>ページが見つかりませんでした。</p>
      <Link to="/">商品一覧へ</Link>
    </div>
  )
}
