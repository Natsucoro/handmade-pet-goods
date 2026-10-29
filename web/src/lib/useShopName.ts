import { DEFAULT_PUBLIC_SETTINGS } from '@domain/types.ts'
import { useEffect, useState } from 'react'
import { useShopData } from '../data/ShopDataContext.tsx'

/** ショップ名（管理画面の設定で変えられる）。読み込むまでは空（仮の名前が一瞬見えないように） */
export function useShopName(): string {
  const data = useShopData()
  const [name, setName] = useState('')
  useEffect(() => {
    data.getPublicSettings().then((s) => {
      setName(s.shopName)
      document.title = s.shopName
    }, () => setName(DEFAULT_PUBLIC_SETTINGS.shopName))
  }, [data])
  return name
}
