import { createContext, useContext } from 'react'
import type { ShopData } from './ShopData.ts'

export const ShopDataContext = createContext<ShopData | null>(null)

export function useShopData(): ShopData {
  const data = useContext(ShopDataContext)
  if (!data) throw new Error('ShopDataContext がありません')
  return data
}
