// 写真をスマホの中で小さくして WebP にする（サーバーで変換しないので費用は0円）。
// 商品ページ用（長い辺1600px）と一覧用（長い辺600px）の2つを作る。

export const LARGE = 1600
export const THUMB = 600
export const MAX_PHOTOS = 20

export interface PreparedImage {
  large: Blob
  thumb: Blob
  /** 画面で見せる用（このページの中だけで使える URL） */
  previewUrl: string
}

/** 長い辺が max を超えないように縮めた大きさ（大きくはしない） */
export function fitSize(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file)
  } catch {
    // createImageBitmap で読めない形式は、ブラウザの画像表示で読む
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function encodeWebp(source: ImageBitmap | HTMLImageElement, max: number): Promise<Blob> {
  const { width, height } = fitSize(source.width, source.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を処理できませんでした')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height)
  try {
    // どのブラウザでも同じように動く変換プログラム（jSquash）
    const { default: encode } = await import('@jsquash/webp/encode')
    const buf = await encode(data, { quality: 80 })
    return new Blob([buf], { type: 'image/webp' })
  } catch (e) {
    // 変換プログラムが読めないときは、ブラウザの変換を使う（WebP にできたときだけ）
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.8))
    if (blob && blob.type === 'image/webp') return blob
    throw e
  }
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const source = await decode(file)
  try {
    const large = await encodeWebp(source, LARGE)
    const thumb = await encodeWebp(source, THUMB)
    return { large, thumb, previewUrl: URL.createObjectURL(thumb) }
  } finally {
    if ('close' in source) source.close()
  }
}
