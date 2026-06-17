import { Card, Typography, Space, Button } from 'antd'
import { WalletOutlined, PieChartOutlined, StockOutlined, LogoutOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'

const { Title, Text } = Typography

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    message.success('已退出登录')
    navigate('/login')
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>财富总览</Title>
        <Space>
          <Text type="secondary">{user?.email}</Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出
          </Button>
        </Space>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space>
            <WalletOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            <div>
              <Text type="secondary">净资产</Text>
              <Title level={3} style={{ margin: 0 }}>¥ 0.00</Title>
            </div>
          </Space>
        </Card>

        <Card title="资产分布">
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="secondary">暂无数据，请添加您的资产</Text>
          </div>
        </Card>

        <Card title="快速操作">
          <Space size="large">
            <Button icon={<WalletOutlined />}>添加资产</Button>
            <Button icon={<StockOutlined />}>查看持仓</Button>
            <Button icon={<PieChartOutlined />}>AI投顾</Button>
          </Space>
        </Card>
      </Space>
    </div>
  )
}