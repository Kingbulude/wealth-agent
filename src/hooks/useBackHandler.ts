import { useEffect, useRef } from 'react'

/**
 * 统一处理移动端返回键 / 浏览器后退手势
 * - Capacitor App：拦截系统返回键
 * - 浏览器 / PWA：通过 history.pushState + popstate 模拟返回关闭
 *
 * @param enabled 是否启用监听
 * @param onBack 返回时的回调（调用方负责关闭弹窗/抽屉）
 */
export function useBackHandler(enabled: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  useEffect(() => {
    if (!enabled) return

    let removeCapacitorListener: (() => void) | undefined
    let popped = false

    // Capacitor 原生 App：拦截硬件返回键
    const registerCapacitor = async () => {
      const cap = (window as any).Capacitor
      if (!cap?.isNativePlatform?.()) return
      try {
        const { App } = await import('@capacitor/app')
        const listener = await App.addListener('backButton', ({ canGoBack }) => {
          // 优先执行关闭回调；若当前页面无其他可返回内容，再允许退出
          if (onBackRef.current) {
            onBackRef.current()
          } else if (!canGoBack) {
            App.exitApp().catch(() => {})
          }
        })
        removeCapacitorListener = () => listener.remove()
      } catch {
        // @capacitor/app 未安装时不阻断浏览器端逻辑
      }
    }
    registerCapacitor()

    // 浏览器 / PWA：压入一个历史状态，使用户按返回键时触发 popstate 而不是退出
    if (typeof history !== 'undefined') {
      history.pushState({ backHandler: true }, '')
      const handlePopState = () => {
        popped = true
        if (onBackRef.current) {
          onBackRef.current()
        }
      }
      window.addEventListener('popstate', handlePopState)

      return () => {
        window.removeEventListener('popstate', handlePopState)
        if (!popped && typeof history !== 'undefined') {
          // 若抽屉正常关闭而非通过返回键关闭，补回一次 history 防止影响上一级历史
          try {
            history.back()
          } catch {}
        }
        removeCapacitorListener?.()
      }
    }

    return () => {
      removeCapacitorListener?.()
    }
  }, [enabled])
}
