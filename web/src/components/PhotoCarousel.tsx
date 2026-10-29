import type { ProductPhoto } from '@domain/types.ts'
import { useRef, useState } from 'react'
import { assetUrl } from '../config.ts'
import { FadeImg } from './FadeImg.tsx'

/** 写真を横にスワイプして切り替える。1枚ごとにキャプションを出す */
export function PhotoCarousel({ photos, alt }: { photos: ProductPhoto[]; alt: string }) {
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)

  if (photos.length === 0) return <div className="carousel-empty">写真はまだありません</div>

  const onScroll = () => {
    const el = track.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }
  const goTo = (i: number) => {
    const el = track.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="carousel" aria-label="商品の写真">
      <div className="carousel-track" ref={track} onScroll={onScroll}>
        {photos.map((p, i) => (
          <figure className="carousel-slide" key={i}>
            <FadeImg
              src={assetUrl(p.url)}
              alt={p.caption || `${alt}の写真${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              draggable={false}
            />
            {p.caption && <figcaption>{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="carousel-dots">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === index ? 'dot active' : 'dot'}
              aria-label={`${i + 1}枚目の写真`}
              aria-current={i === index}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
