import { useEffect, useState } from 'react'

export type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'done'; value: T }

/** データを1回読む。deps が変わったら読み直す */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): Load<T> {
  const [result, setResult] = useState<Load<T>>({ state: 'loading' })
  // deps は呼ぶ側が決める（load は毎回作り直されるので入れない）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true
    setResult({ state: 'loading' })
    load().then(
      (value) => alive && setResult({ state: 'done', value }),
      (e) => {
        console.error(e)
        if (alive) setResult({ state: 'error' })
      },
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return result
}
