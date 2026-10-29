import { useLocation, useNavigate } from 'react-router-dom'

/** お試し表示だけ：お店と管理画面を行き来するボタン */
export function SampleSwitch() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const inAdmin = pathname.startsWith('/admin')
  return (
    <button type="button" className="sample-switch" onClick={() => navigate(inAdmin ? '/' : '/admin')}>
      {inAdmin ? 'お店の画面へ' : '管理画面へ（お試し）'}
    </button>
  )
}
