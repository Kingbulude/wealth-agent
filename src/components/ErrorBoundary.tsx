import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到错误:', error)
    console.error('[ErrorBoundary] 组件栈:', errorInfo.componentStack)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0e1a',
          color: '#fff',
          padding: 20
        }}>
          <div style={{
            maxWidth: 500,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center'
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: 28
            }}>
              ⚠️
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700 }}>页面加载出错</h2>
            <p style={{
              margin: '0 0 20px',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 14,
              lineHeight: 1.6
            }}>
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #d8be88, #b08d4f)',
                color: '#0a0e1a',
                border: 'none',
                borderRadius: 10,
                padding: '12px 32px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
