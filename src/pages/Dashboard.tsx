import { Card, Typography, Space, Button, Tabs } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useAuthStore } from '../renderer/stores/authStore'
import { useAssetStore } from '../stores/assetStore'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useEffect, useState } from 'react'
import AssetList from '../components/AssetList'
import WealthSummaryCards from '../components/WealthSummaryCards'
import AssetPieChart from '../components/AssetPieChart'
import AssetBarChart from '../components/AssetBarChart'
import HoldingList from '../components/HoldingList'
import AIAdvisor from '../components/AIAdvisor'

const { Title, Text } = Typography

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { assets, loadAssets } = useAssetStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadAssets()
  }, [])

  const handleLogout = () => {
    logout()
    message.success('已退出登录')
    navigate('/login')
  }

  const tabItems = [
    {
      key: 'overview',
      label: '资产总览',
      children: (
        <>
          <WealthSummaryCards assets={assets} />
          
          <div style={{ marginTop: 24 }}>
            <Card 
              title="资产分布" 
              style={{ marginBottom: 16 }}
              extra={<Text type="secondary">单位：元</Text>}
            >
              <AssetPieChart assets={assets} height={350} />
            </Card>

            <Card 
              title="资产构成"
              extra={<Text type="secondary">单位：元</Text>}
            >
              <AssetBarChart assets={assets} height={300} />
            </Card>
          </div>
        </>
      )
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
        <Title level={2} style={{ margin: 0 }}>
          💰 财富管理智能体
        </Title>
        <Space>
          <Text type="secondary">{user?.email}</Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出
          </Button>
        </Space>
      </div>

      {/* Tab切换 */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </div>
  )
}