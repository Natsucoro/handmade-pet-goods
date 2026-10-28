// 説明文に使える「可愛い色のパレット」。自分で登録した色（#rrggbb）はステップ2で足す。
export const PALETTE: Record<string, string> = {
  pink: '#e8789a',
  coral: '#ef8a6b',
  lemon: '#c9a227',
  mint: '#3fa98a',
  sky: '#4a9fd8',
  lavender: '#9b7fd1',
  brown: '#8a6a55',
}

/** 色名か #rrggbb だけを通す。それ以外（悪い書き込みなど）は使わない */
export function safeColor(color: string | undefined): string | undefined {
  if (!color) return undefined
  if (color in PALETTE) return PALETTE[color]
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined
}
