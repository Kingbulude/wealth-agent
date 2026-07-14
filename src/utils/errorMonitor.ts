// 全局错误监控与日志上报
// 捕获未处理的错误、Promise 拒绝、跨域脚本错误，统一记录到控制台
// 生产环境会上报到后端 API（可选）

interface ErrorReport {
  message: string
  stack?: string
  source?: string
  line?: number
  column?: number
  url: string
  userAgent: string
  timestamp: number
  type: 'js_error' | 'promise_rejection' | 'console_error' | 'react_error'
  extra?: any
}

class ErrorMonitor {
  private enabled = true
  private queue: ErrorReport[] = []
  private flushInterval: any = null
  private readonly MAX_QUEUE = 50
  private readonly FLUSH_INTERVAL = 30 * 1000

  init() {
    if (!this.enabled || typeof window === 'undefined') return

    // JS 错误
    window.addEventListener('error', (e) => {
      this.report({
        message: e.message,
        stack: e.error?.stack,
        source: e.filename,
        line: e.lineno,
        column: e.colno,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        type: 'js_error'
      })
    })

    // Promise 拒绝
    window.addEventListener('unhandledrejection', (e) => {
      this.report({
        message: e.reason?.message || String(e.reason),
        stack: e.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        type: 'promise_rejection',
        extra: { reason: String(e.reason) }
      })
    })

    // 定期刷新队列
    this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL)

    // 页面卸载时强制 flush
    window.addEventListener('beforeunload', () => this.flush(true))
  }

  // 手动上报错误（用于业务代码）
  captureError(error: Error | string, extra?: any) {
    this.report({
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: Date.now(),
      type: 'js_error',
      extra
    })
  }

  // React 错误边界回调
  captureReactError(error: Error, errorInfo: React.ErrorInfo) {
    this.report({
      message: error.message,
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: Date.now(),
      type: 'react_error',
      extra: { componentStack: errorInfo.componentStack }
    })
  }

  private report(report: ErrorReport) {
    if (!this.enabled) return

    // 开发环境直接打印
    if (import.meta.env.DEV) {
      console.error('[ErrorMonitor]', report.type, report.message, report)
      return
    }

    this.queue.push(report)
    if (this.queue.length > this.MAX_QUEUE) {
      this.queue.shift()  // 保留最近的错误
    }

    // 严重错误立即上报
    if (this.isCritical(report)) {
      this.flush(true)
    }
  }

  private isCritical(report: ErrorReport): boolean {
    const criticalPatterns = [
      /TypeError: Cannot read prop/i,
      /ReferenceError: .* is not defined/i,
      /NetworkError/i,
      /ChunkLoadError/i,
      /白屏|white\s*screen/i
    ]
    return criticalPatterns.some(p => p.test(report.message))
  }

  private async flush(immediate = false) {
    if (this.queue.length === 0) return
    const reports = [...this.queue]
    this.queue = []

    if (immediate) {
      // 使用 sendBeacon 确保页面关闭时也能上报
      if (navigator.sendBeacon) {
        try {
          navigator.sendBeacon(
            '/api/log/error',
            new Blob([JSON.stringify({ reports })], { type: 'application/json' })
          )
          return
        } catch (e) {
          // 继续降级到 fetch
        }
      }
    }

    try {
      await fetch('/api/log/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports }),
        keepalive: true
      })
    } catch (e) {
      // 上报失败时回滚队列
      this.queue.unshift(...reports)
    }
  }

  disable() {
    this.enabled = false
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
  }
}

export const errorMonitor = new ErrorMonitor()
