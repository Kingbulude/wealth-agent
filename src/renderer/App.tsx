import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import BackgroundMusic from '@/components/BackgroundMusic'
import OnboardingGuide from '@/components/OnboardingGuide'
import { useAuthStore } from './stores/authStore'
import Dashboard from '@/pages/Dashboard'
import LoginPage from './pages/LoginPage'
import { configWeChatShare, DEFAULT_SHARE_CONTENT } from '@/utils/wechat'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  // 微信环境适配：初始化分享配置
  useEffect(() => {
    configWeChatShare(DEFAULT_SHARE_CONTENT)
  }, [])

  return (
    <ErrorBoundary>
      <ConfigProvider locale={zhCN}>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        {/* 用户指引 - 新用户首次登录显示 */}
        <OnboardingGuide />
        {/* 背景音乐 - 只在已登录时播放 */}
        <BackgroundMusic />
      </ConfigProvider>
    </ErrorBoundary>
  )
}

export default App
