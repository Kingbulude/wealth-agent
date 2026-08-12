import { useEffect, useState } from 'react'

/**
 * 响应式断点判断 hook
 * 与 src/renderer/index.css 保持一致
 */
const BREAKPOINTS = {
  xs: 375,   // iPhone SE 等紧凑屏
  sm: 480,   // 小屏手机
  md: 768,   // 手机/平板分界
  lg: 1024,  // 桌面端起点
  xl: 1440   // 宽屏
} as const

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
    mql.addListener(handler)
    return () => mql.removeListener(handler)
  }, [query])

  return matches
}

/** 是否移动端 (≤768px) */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md}px)`)
}
