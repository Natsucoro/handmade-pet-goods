// 管理画面で使う小さな道具

export function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** 数字の入力欄の文字を数にする。空や数でなければ null */
export function toInt(text: string): number | null {
  const t = text.normalize('NFKC').replace(/[,，円\s]/g, '')
  if (!/^[+-]?\d+$/.test(t)) return null
  return Number(t)
}
