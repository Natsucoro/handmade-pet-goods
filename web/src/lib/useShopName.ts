import { DEFAULT_PUBLIC_SETTINGS } from '@domain/types.ts'
import { useEffect, useState } from 'react'
import { useShopData } from '../data/ShopDataContext.tsx'

/** ショップ名（管理画面の設定で変えられる）。読み込むまでは仮の名前 */
export function useShopName(): string {
  const data = useShopData()
  const [name, setName] = useState(DEFAULT_PUBLIC_SETTINGS.shopName)
  useEffect(() => {
    data.getPublicSettings().then((s) => {
      setName(s.shopName)
      document.title = s.shopName
    }, () => {})
  }, [data])
  return name
}
