/** 3000 → "3,000円" */
export function yen(n: number): string {
  return `${n.toLocaleString('ja-JP')}円`
}

/** 追加料金の表示。0 なら空、500 → "+500円"、-200 → "-200円" */
export function extraYen(n: number): string {
  if (n === 0) return ''
  return `${n > 0 ? '+' : '-'}${Math.abs(n).toLocaleString('ja-JP')}円`
}
