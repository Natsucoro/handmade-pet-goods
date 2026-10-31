import { useNavigate } from 'react-router-dom'

/** お試し表示だけ：お店から管理画面へ（管理画面からお店へは、管理画面の「お店を見る」で戻る） */
export function SampleSwitch() {
  const navigate = useNavigate()
  return (
    <button type="button" className="sample-switch" onClick={() => navigate('/admin')}>
      管理画面へ（お試し）
    </button>
  )
}
