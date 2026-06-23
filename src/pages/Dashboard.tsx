// 财富管理智能体 — 主页面（4个Tab）
// 数据流：
//   - 资产总览：assetStore + holdingStore（持仓联动合并）
//   - 资产管理：assetStore + holdingStore（持仓联动合并）
//   - 持仓管理：holdingStore（唯一写入端）
//   - AI投顾：读取 assetStore + holdingStore 做上下文

import { Card, Typography, Space, Button, Tabs } from 'antd'
import { LogoutOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAuthStore } from '../renderer/stores/authStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAssetStore } from '../stores/assetStore'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useEffect, useState, useRef } from 'react'
import PortfolioOverview from '../components/PortfolioOverview'
import AssetList from '../components/AssetList'
import HoldingList from '../components/HoldingList'
import AIAdvisor from '../components/AIAdvisor'

const { Text } = Typography

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { refreshPrices, refreshing } = useHoldingStore()
  const { loadAssets } = useAssetStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // 启动定时轮询行情（5分钟 = 300秒）
  useEffect(() => {
    // 立即刷新一次
    refreshPrices()
    // 定时刷新
    autoRefreshTimer.current = setInterval(() => {
      refreshPrices()
    }, 300_000) // 5分钟

    // 监听切换 Tab 事件
    const handler = (e: any) => {
      if (e.detail?.key) {
        setActiveTab(e.detail.key)
      }
    }
    window.addEventListener('switch-tab', handler)

    return () => {
      if (autoRefreshTimer.current) {
        clearInterval(autoRefreshTimer.current)
        autoRefreshTimer.current = null
      }
      window.removeEventListener('switch-tab', handler)
    }
  }, [])

  const handleLogout = () => {
    if (autoRefreshTimer.current) {
      clearInterval(autoRefreshTimer.current)
      autoRefreshTimer.current = null
    }
    logout()
    message.success('已退出登录')
    navigate('/login')
  }

  const handleRefresh = async () => {
    message.info('正在刷新数据…')
    await Promise.all([refreshPrices(), loadAssets()])
    message.success('刷新完成')
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    // 切到对应 Tab 时刷新对应数据
    if (key === 'holdings') {
      refreshPrices()
    }
    if (key === 'overview' || key === 'management') {
      loadAssets()
      refreshPrices()
    }
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
      children: <AssetList />
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
            {refreshing && <span style={{ color: '#faad14' }}>行情刷新中…</span>}
            {!refreshing && '数据已同步'}
          </Text>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
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
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        size="large"
      />
    </div>
  )
}
