// 财富管理智能体 — 主页面（4个Tab）
// 数据流：
//   - 资产总览：assetStore + portfolioStore（持仓联动合并）
//   - 资产管理：assetStore + portfolioStore（投资资产分类下持仓联动）
//   - 持仓管理：holdingStore（唯一写入端）
//   - AI投顾：portfolioStore + assetStore

import { Card, Typography, Space, Button, Tabs } from 'antd'
import { LogoutOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAuthStore } from '../renderer/stores/authStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useAssetStore } from '../stores/assetStore'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useEffect, useState } from 'react'
import PortfolioOverview from '../components/PortfolioOverview'
import AssetList from '../components/AssetList'
import HoldingList from '../components/HoldingList'
import AIAdvisor from '../components/AIAdvisor'

const { Text } = Typography

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { loadPortfolio, startAutoRefresh, stopAutoRefresh, refreshing, data } = usePortfolioStore()
  const { loadAssets } = useAssetStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  // 页面加载时启动定时轮询 + 监听 Tab 切换事件
  useEffect(() => {
    startAutoRefresh()
    loadAssets()

    // 监听联动跳转事件
    const handler = (e: any) => {
      if (e.detail?.key) {
        setActiveTab(e.detail.key)
      }
    }
    window.addEventListener('switch-tab', handler)
    return () => {
      stopAutoRefresh()
      window.removeEventListener('switch-tab', handler)
    }
  }, [])

  const handleLogout = () => {
    stopAutoRefresh()
    logout()
    message.success('已退出登录')
    navigate('/login')
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    // 切到持仓或资产管理时也重新拉数据
    if (key === 'holdings') loadPortfolio()
    if (key === 'overview' || key === 'management') {
      loadPortfolio()
      loadAssets()
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
              loadAssets()
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
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        size="large"
      />
    </div>
  )
}
