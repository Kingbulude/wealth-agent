import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import OnboardingGuide from '@/components/OnboardingGuide'
import AutoUpdater from '@/components/AutoUpdater'
import { useAuthStore } from './stores/authStore'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const LoginPage = lazy(() => import('./pages/LoginPage'))

const PageFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
    <Spin size="large" />
  </div>
)

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
  return (
    <ErrorBoundary>
      <ConfigProvider locale={zhCN}>
        <HashRouter>
          <Suspense fallback={<PageFallback />}>
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
          </Suspense>
        </HashRouter>
        {/* 用户指引 - 新用户首次登录显示 */}
        <OnboardingGuide />
        {/* 自动更新 */}
        <AutoUpdater />
      </ConfigProvider>
    </ErrorBoundary>
  )
}

export default App
