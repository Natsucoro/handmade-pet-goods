export interface OrderDraft { answers: Record<string, string>; quantity: number }

// 購入手続きから「戻る」で来たときに、選んだ内容を元に戻すため（このタブの中だけ）
const draftKey = (id: string) => `handmade-pet-goods:draft:${id}`
export function loadDraft(id: string): OrderDraft | undefined {
  try {
    const v = JSON.parse(sessionStorage.getItem(draftKey(id)) ?? 'null')
    return v && typeof v.quantity === 'number' && typeof v.answers === 'object' ? v : undefined
  } catch {
    return undefined
  }
}
export function saveDraft(id: string, d: OrderDraft | null): void {
  try {
    if (d) sessionStorage.setItem(draftKey(id), JSON.stringify(d))
    else sessionStorage.removeItem(draftKey(id))
  } catch {
    // 覚えられなくても注文はできる
  }
}
