// 财富管理智能体 — 主页面（4个Tab统一数据源）
// 数据流：后端 /api/portfolio/summary → portfolioStore → 所有 Tab 共享
import { Card, Typography, Space, Button, Tabs } from 'antd'
import { LogoutOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAuthStore } from '../renderer/stores/authStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useEffect } from 'react'
import PortfolioOverview from '../components/PortfolioOverview'
import PortfolioManagement from '../components/PortfolioManagement'
import HoldingList from '../components/HoldingList'
import AIAdvisor from '../components/AIAdvisor'

const { Text } = Typography

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { loadPortfolio, startAutoRefresh, stopAutoRefresh, refreshing, data } = usePortfolioStore()
  const navigate = useNavigate()

  // 页面加载时启动定时轮询
  useEffect(() => {
    startAutoRefresh()
    return () => stopAutoRefresh()
  }, [])

  const handleLogout = () => {
    stopAutoRefresh()
    logout()
    message.success('已退出登录')
    navigate('/login')
  }

  const tabItems = [
    {
      key: 'overview',
      label: '资产总览',
      children: <PortfolioOverview />
    },
    {
      key: 'management',
      label: '资产管理',
      children: <PortfolioManagement />
    },
    {
      key: 'holdings',
      label: '持仓管理',
      children: <HoldingList />
    },
    {
      key: 'advisor',
      label: 'AI投顾',
      children: <AIAdvisor />
    }
  ]

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          💰 财富管理智能体
        </Typography.Title>
        <Space>
          <Text type="secondary">
            {data?.summary?.updateTime && (
              <span>
                {new Date(data.summary.updateTime).toLocaleString('zh-CN', { hour12: false })} 更新
                {refreshing && <span style={{ color: '#faad14' }}> · 刷新中…</span>}
              </span>
            )}
          </Text>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadPortfolio()
              message.info('正在刷新数据…')
            }}
            loading={refreshing}
          >
            刷新
          </Button>
          <Text type="secondary">{user?.email}</Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出
          </Button>
        </Space>
      </div>

      {/* Tab切换 */}
      <Tabs
        defaultActiveKey="overview"
        items={tabItems}
        size="large"
      />
    </div>
  )
}
