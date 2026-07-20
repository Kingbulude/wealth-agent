import { useEffect, useState } from 'react'

/**
 * 响应式断点判断 hook
 * 与 src/renderer/index.css 保持一致
 */
export const BREAKPOINTS = {
  xs: 375,   // iPhone SE 等紧凑屏
  sm: 480,   // 小屏手机
  md: 768,   // 手机/平板分界
  lg: 1024,  // 桌面端起点
  xl: 1440   // 宽屏
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

export function useMediaQuery(query: string): boolean {
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

/** 是否平板 (769-1023px) */
export function useIsTablet(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.md + 1}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`)
}

/** 是否桌面端 (≥1024px) */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`)
}

/** 是否宽屏 (≥1440px) */
export function useIsWide(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`)
}

/** 是否小屏手机 (≤480px) */
export function useIsSmallMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.sm}px)`)
}

/** 是否超小屏 (≤375px) */
export function useIsTinyMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.xs}px)`)
}
