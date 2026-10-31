import { checkLine, maxQuantity } from '@domain/checkout.ts'
import type { OrderItem, Product, ShippingTable } from '@domain/types.ts'
import { useShopData } from '../../data/ShopDataContext.tsx'
import type { CartLine } from '../../lib/cart.ts'
import { useLoad } from '../../lib/useLoad.ts'

export interface CartRow {
  line: CartLine
  product: Product | null
  /** 買える行は、金額などを計算したもの */
  item: OrderItem | null
  /** 買えない理由 */
  problem: string | null
}

/** カートの商品と送料表を読み、行ごとに金額と問題を出す（サーバーと同じ決まりで） */
export function useCartDetails(lines: CartLine[]) {
  const data = useShopData()
  const ids = [...new Set(lines.map((l) => l.productId))].sort()
  const loaded = useLoad(async () => {
    const products: Record<string, Product> = {}
    await Promise.all(ids.map(async (id) => {
      const p = await data.getProduct(id)
      if (p) products[id] = p
    }))
    const tables: Record<string, ShippingTable> = {}
    await Promise.all([...new Set(Object.values(products).map((p) => p.shippingTableId))].map(async (id) => {
      const t = await data.getShippingTable(id)
      if (t) tables[id] = t
    }))
    return { products, tables }
  }, [data, ids.join(',')])

  if (loaded.state !== 'done') return loaded.state === 'error' ? ({ state: 'error' } as const) : ({ state: 'loading' } as const)
  const { products, tables } = loaded.value
  // 同じ商品の行を合わせて、在庫を超えていないか
  const used = new Map<string, number>()
  const rows: CartRow[] = lines.map((line) => {
    const product = products[line.productId] ?? null
    const r = checkLine(line, product ?? undefined)
    if ('error' in r) return { line, product, item: null, problem: r.error }
    const max = maxQuantity(product!)
    const before = used.get(line.productId) ?? 0
    used.set(line.productId, before + line.quantity)
    if (max !== null && before + line.quantity > max) {
      return { line, product, item: r.item, problem: max - before > 0 ? `在庫は残り${max}個です。個数を減らしてください` : '在庫がなくなりました。カートから削除してください' }
    }
    return { line, product, item: r.item, problem: null }
  })
  const ok = rows.length > 0 && rows.every((r) => !r.problem)
  const subtotal = rows.reduce((n, r) => n + (r.item ? r.item.unitPrice * r.item.quantity : 0), 0)
  return { state: 'done', rows, products, tables, ok, subtotal } as const
}
