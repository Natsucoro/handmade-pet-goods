import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

/** 読み込めたら、ふわっと出る画像 */
export function FadeImg(props: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    // すでに読み込み済み（キャッシュ）のときは、すぐ出す
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true)
  }, [props.src])
  return (
    <img
      {...props}
      ref={ref}
      className={`${props.className ?? ''} fade-img${loaded ? ' is-loaded' : ''}`}
      onLoad={(e) => {
        setLoaded(true)
        props.onLoad?.(e)
      }}
    />
  )
}
