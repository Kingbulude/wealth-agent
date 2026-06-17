import { useState } from 'react'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const navigate = useNavigate()
  const { login, register } = useAuthStore()

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      let success: boolean
      if (isRegister) {
        success = await register(values.email, values.password)
        if (success) {
          message.success('注册成功！')
        } else {
          message.error('该邮箱已被注册')
          setLoading(false)
          return
        }
      } else {
        success = await login(values.email, values.password)
        if (!success) {
          message.error('邮箱或密码错误')
          setLoading(false)
          return
        }
      }
      navigate('/')
    } catch (error) {
      message.error('操作失败，请重试')
    }
    setLoading(false)
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>财富管理智能体</Title>
          <Text type="secondary">
            {isRegister ? '创建新账号' : '欢迎回来'}
          </Text>
        </div>

        <Form
          name="auth"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder="邮箱" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="密码" 
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
            >
              {isRegister ? '注册' : '登录'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text>
              {isRegister ? '已有账号？' : '还没有账号？'}
              <a 
                onClick={() => setIsRegister(!isRegister)}
                style={{ marginLeft: 8 }}
              >
                {isRegister ? '登录' : '注册'}
              </a>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  )
}