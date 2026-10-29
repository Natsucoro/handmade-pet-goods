// 本物・練習用の Firebase を使う管理画面のデータとログイン。
import type { Category, Product, ShippingTable, ShopSettings } from '@domain/types.ts'
import type { FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore/lite'
import { connectStorageEmulator, deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { DATA_MODE } from '../config.ts'
import { EMULATOR_HOST } from '../data/firebaseApp.ts'
import { AdminError, type AdminData, type AdminSession, type SessionState } from './AdminData.ts'

let connected = false

/** 古い形で保存された書類でも動くように、足りない項目を補う */
const toProduct = (id: string, d: unknown): Product => {
  const p = d as Partial<Product>
  return { ...(p as Product), categoryIds: p.categoryIds ?? [], sortOrder: p.sortOrder ?? 0, id }
}
const toCategory = (id: string, d: unknown): Category => {
  const c = d as Partial<Category>
  return { name: c.name ?? '', group: c.group ?? '', sortOrder: c.sortOrder ?? 0, id }
}

export function createFirebaseAdmin(app: FirebaseApp): { data: AdminData; session: AdminSession } {
  const db = getFirestore(app)
  const auth = getAuth(app)
  const storage = getStorage(app)
  if (DATA_MODE === 'emulator' && !connected) {
    connected = true
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true })
    connectStorageEmulator(storage, EMULATOR_HOST, 9199)
    try {
      connectFirestoreEmulator(db, EMULATOR_HOST, 8080)
    } catch {
      // お店の画面ですでにつないでいる
    }
  }

  const upload = async (path: string, blob: Blob) => {
    const r = ref(storage, path)
    await uploadBytes(r, blob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' })
    return getDownloadURL(r)
  }
  const removeFile = async (path?: string) => {
    if (!path) return
    try {
      await deleteObject(ref(storage, path))
    } catch (e) {
      if ((e as { code?: string }).code !== 'storage/object-not-found') console.warn('写真を消せませんでした', path, e)
    }
  }

  const data: AdminData = {
    async listProducts() {
      const snap = await getDocs(collection(db, 'products'))
      return snap.docs
        .map((d) => toProduct(d.id, d.data()))
        .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAtMs - a.createdAtMs)
    },
    async getProduct(id) {
      const snap = await getDoc(doc(db, 'products', id))
      return snap.exists() ? toProduct(snap.id, snap.data()) : null
    },
    newId: () => doc(collection(db, 'products')).id,
    async saveProduct(product, photos, removed) {
      const finalPhotos = []
      for (const d of photos) {
        if (d.existing) {
          finalPhotos.push({ ...d.existing, caption: d.caption })
          continue
        }
        const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        const storagePath = `products/${product.id}/${name}-1600.webp`
        const thumbStoragePath = `products/${product.id}/${name}-600.webp`
        const [url, thumbUrl] = await Promise.all([upload(storagePath, d.pending!.large), upload(thumbStoragePath, d.pending!.thumb)])
        finalPhotos.push({ url, thumbUrl, caption: d.caption, storagePath, thumbStoragePath })
      }
      const { id, ...rest } = product
      const saved = { ...rest, photos: finalPhotos }
      await setDoc(doc(db, 'products', id), JSON.parse(JSON.stringify(saved)))
      // 保存できてから、外した写真を消す（無料枠を無駄に使わない）
      await Promise.all(removed.flatMap((p) => [removeFile(p.storagePath), removeFile(p.thumbStoragePath)]))
      return { ...saved, id }
    },
    async deleteProduct(p) {
      await deleteDoc(doc(db, 'products', p.id))
      await Promise.all(p.photos.flatMap((ph) => [removeFile(ph.storagePath), removeFile(ph.thumbStoragePath)]))
    },
    async saveProductOrder(ids) {
      const batch = writeBatch(db)
      ids.forEach((id, i) => batch.update(doc(db, 'products', id), { sortOrder: i + 1 }))
      await batch.commit()
    },
    async listCategories() {
      const snap = await getDocs(collection(db, 'categories'))
      return snap.docs
        .map((d) => toCategory(d.id, d.data()))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    },
    async saveCategory(c) {
      const { id, ...rest } = c
      await setDoc(doc(db, 'categories', id), rest)
    },
    async deleteCategory(id) {
      const used = await getDocs(query(collection(db, 'products'), where('categoryIds', 'array-contains', id)))
      const batch = writeBatch(db)
      used.docs.forEach((d) =>
        batch.update(d.ref, { categoryIds: ((d.data().categoryIds as string[]) ?? []).filter((x) => x !== id) }),
      )
      batch.delete(doc(db, 'categories', id))
      await batch.commit()
    },
    async saveCategoryOrder(ids) {
      const batch = writeBatch(db)
      ids.forEach((id, i) => batch.update(doc(db, 'categories', id), { sortOrder: i + 1 }))
      await batch.commit()
    },
    async listShippingTables() {
      const snap = await getDocs(collection(db, 'shippingTables'))
      return snap.docs.map((d) => ({ ...(d.data() as Omit<ShippingTable, 'id'>), id: d.id }))
    },
    async saveShippingTable(t) {
      const { id, ...rest } = t
      await setDoc(doc(db, 'shippingTables', id), JSON.parse(JSON.stringify(rest)))
    },
    async deleteShippingTable(id) {
      const used = await getDocs(query(collection(db, 'products'), where('shippingTableId', '==', id)))
      if (!used.empty) {
        throw new AdminError(`この送料表を使っている商品があります（${used.docs.map((d) => d.data().name).join('、')}）`)
      }
      await deleteDoc(doc(db, 'shippingTables', id))
    },
    async getSettings() {
      const snap = await getDoc(doc(db, 'settings', 'shop'))
      return { customColors: [], ...(snap.data() as Partial<ShopSettings> | undefined) }
    },
    async saveSettings(s) {
      await setDoc(doc(db, 'settings', 'shop'), s, { merge: true })
    },
  }

  let state: SessionState = { status: 'loading' }
  const subs = new Set<(s: SessionState) => void>()
  const emit = (s: SessionState) => {
    state = s
    subs.forEach((cb) => cb(s))
  }
  onAuthStateChanged(auth, async (user) => {
    if (!user) return emit({ status: 'signedOut' })
    try {
      const adminDoc = await getDoc(doc(db, 'admins', user.uid))
      emit(adminDoc.exists() ? { status: 'admin', email: user.email ?? '' } : { status: 'notAdmin', email: user.email ?? '', uid: user.uid })
    } catch {
      emit({ status: 'notAdmin', email: user.email ?? '', uid: user.uid })
    }
  })

  if (DATA_MODE === 'emulator') {
    // 練習用だけ：自動テストから Google ログインのふりをする
    ;(window as unknown as Record<string, unknown>).__testSignIn = (email: string) =>
      signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })))
  }

  const session: AdminSession = {
    get: () => state,
    subscribe(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    async signIn() {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      try {
        await signInWithPopup(auth, provider)
      } catch (e) {
        // スマホでポップアップが止められたときは、画面ごと切り替えるログインにする
        if ((e as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(auth, provider)
        else throw e
      }
    },
    async signOut() {
      await signOut(auth)
    },
  }
  return { data, session }
}
