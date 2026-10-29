import { createContext, useContext } from 'react'
import type { AdminData, AdminSession } from './AdminData.ts'

export interface AdminCtx {
  data: AdminData
  session: AdminSession
  /** 保存したあと、お店の画面が新しい内容を読み直すように知らせる */
  changed: () => void
  toast: (message: string) => void
}

export const AdminContext = createContext<AdminCtx | null>(null)

export function useAdmin(): AdminCtx {
  const c = useContext(AdminContext)
  if (!c) throw new Error('AdminContext がありません')
  return c
}
