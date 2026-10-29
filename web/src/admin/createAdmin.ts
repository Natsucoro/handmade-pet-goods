import { DATA_MODE } from '../config.ts'
import { getFirebaseApp } from '../data/firebaseApp.ts'
import type { AdminData, AdminSession } from './AdminData.ts'

export async function createAdmin(): Promise<{ data: AdminData; session: AdminSession }> {
  if (DATA_MODE === 'sample') {
    const { createSampleAdminData, createSampleSession } = await import('./sampleAdmin.ts')
    return { data: createSampleAdminData(), session: createSampleSession() }
  }
  const { createFirebaseAdmin } = await import('./firebaseAdmin.ts')
  return createFirebaseAdmin(await getFirebaseApp())
}
