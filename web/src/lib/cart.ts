// カート。この端末（ブラウザ）の中だけに覚えておく。入れるのは商品IDと選んだ内容と個数だけ（個人情報は入れない）。
import { MAX_LINES, MAX_QUANTITY, type CartLineInput } from '@domain/checkout.ts'
import { useSyncExternalStore } from 'react'

export interface CartLine extends CartLineInput {
  /** 行の目印 */
  key: string
}

const KEY = 'handmade-pet-goods:cart'
const listeners = new Set<() => void>()
let cache: CartLine[] | null = null

function read(): CartLine[] {
  if (cache) return cache
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    cache = Array.isArray(v)
      ? v.filter((l) => l && typeof l.productId === 'string' && Number.isInteger(l.quantity) && l.quantity > 0 && typeof l.answers === 'object')
      : []
  } catch {
    cache = []
  }
  return cache!
}

function write(lines: CartLine[]): void {
  cache = lines
  try {
    localStorage.setItem(KEY, JSON.stringify(lines))
  } catch {
    // 覚えられなくても、このページを開いている間は使える
  }
  listeners.forEach((l) => l())
}

// ほかのタブでカートを変えたときも合わせる
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = null
      listeners.forEach((l) => l())
    }
  })
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, read)
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0)

/** 空の答えを外して並べ、同じ内容かどうかを比べられるようにする */
function normalize(answers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(answers)
      .map(([k, v]) => [k, String(v).trim()] as const)
      .filter(([, v]) => v !== '')
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

export type AddResult = 'added' | 'merged' | 'full'

/** カートに入れる。同じ商品・同じ内容なら個数を足す */
export function addToCart(productId: string, answers: Record<string, string>, quantity: number): AddResult {
  const lines = read()
  const a = normalize(answers)
  const same = lines.find((l) => l.productId === productId && JSON.stringify(normalize(l.answers)) === JSON.stringify(a))
  if (same) {
    write(lines.map((l) => (l === same ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + quantity) } : l)))
    return 'merged'
  }
  if (lines.length >= MAX_LINES) return 'full'
  write([...lines, { key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, productId, answers: a, quantity }])
  return 'added'
}

export function setLineQuantity(key: string, quantity: number): void {
  write(read().map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) } : l)))
}

export function removeLine(key: string): void {
  write(read().filter((l) => l.key !== key))
}

export function clearCart(): void {
  write([])
}
