import { useState } from 'react'
import { Form, Input, message, Typography } from 'antd'
import { LockOutlined, MailOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const { Text } = Typography

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
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-bg-grid" />
        <div className="login-bg-glow login-bg-glow-1" />
        <div className="login-bg-glow login-bg-glow-2" />
        <div className="login-bg-glow login-bg-glow-3" />
        <div className="login-bg-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="login-particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              opacity: 0.2 + Math.random() * 0.4
            }} />
          ))}
        </div>
      </div>

      {/* Login card */}
      <div className="login-container">
        <div className="login-card">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-logo">
              <svg viewBox="0 0 40 40" fill="none" width="48" height="48">
                <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#logoGrad)" />
                <path d="M20 10v20M12 20h16" stroke="#0a0e1a" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="20" cy="20" r="8" stroke="#0a0e1a" strokeWidth="1.5" fill="none" opacity="0.4" />
                <defs>
                  <linearGradient id="logoGrad" x1="2" y1="2" x2="38" y2="38">
                    <stop stopColor="#d8be88" />
                    <stop offset="1" stopColor="#b08d4f" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="login-title">Wealth Terminal</h1>
            <p className="login-subtitle">财富管理智能体</p>
          </div>

          {/* Form */}
          <Form
            name="auth"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            requiredMark={false}
          >
            <div className="login-form-label">邮箱地址</div>
            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
              style={{ marginBottom: 20 }}
            >
              <Input
                prefix={<MailOutlined style={{ color: 'rgba(201,167,106,0.5)' }} />}
                placeholder="your@email.com"
                className="login-input"
                size="large"
              />
            </Form.Item>

            <div className="login-form-label">密码</div>
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6位' }
              ]}
              style={{ marginBottom: 28 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'rgba(201,167,106,0.5)' }} />}
                placeholder="输入密码"
                className="login-input"
                size="large"
                iconRender={(visible) => visible
                  ? <EyeOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />
                  : <EyeInvisibleOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />
                }
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 20 }}>
              <button
                type="submit"
                className={`login-submit-btn ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <span className="login-btn-loading">
                    <span className="login-spinner" />
                    处理中…
                  </span>
                ) : (
                  isRegister ? '创建账号' : '登录'
                )}
              </button>
            </Form.Item>
          </Form>

          {/* Switch */}
          <div className="login-switch">
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
              {isRegister ? '已有账号？' : '还没有账号？'}
            </Text>
            <a
              className="login-switch-link"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? '立即登录' : '立即注册'}
            </a>
          </div>

          {/* Footer */}
          <div className="login-footer">
            <span className="login-footer-dot" />
            <span>端到端加密 · 数据安全</span>
            <span className="login-footer-dot" />
          </div>
        </div>
      </div>
    </div>
  )
}
