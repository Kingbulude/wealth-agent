import { useState, useEffect, useRef } from 'react'
import { Button } from 'antd'
import {
  AreaChartOutlined,
  WalletOutlined,
  StockOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import { useAuthStore } from '@/renderer/stores/authStore'

const STORAGE_KEY_PREFIX = 'wealth_agent_onboarding_'

function getStorageKey(userId: string): string {
  return STORAGE_KEY_PREFIX + userId
}

interface GuideStep {
  key: string
  icon: React.ReactNode
  title: string
  content: React.ReactNode
}

const GUIDE_STEPS: GuideStep[] = [
  {
    key: 'welcome',
    icon: <span className="guide-emoji">👋</span>,
    title: '欢迎使用「财富管理智能体」',
    content: (
      <div className="guide-content">
        <p>一站式个人财富管理与智能分析平台</p>
        <p className="guide-highlight">帮助您管理资产、跟踪持仓、发现投资机会</p>
      </div>
    )
  },
  {
    key: 'assets',
    icon: <WalletOutlined />,
    title: '💰 资产管理',
    content: (
      <div className="guide-content">
        <p>集中管理您的所有资产</p>
        <ul className="guide-list">
          <li>银行卡存款、支付宝余额等现金资产</li>
          <li>股票、基金等投资资产</li>
          <li>房产、其他资产一目了然</li>
        </ul>
      </div>
    )
  },
  {
    key: 'wealth',
    icon: <AreaChartOutlined />,
    title: '📊 财富分布总览',
    content: (
      <div className="guide-content">
        <p>可视化展示您的资产配置</p>
        <ul className="guide-list">
          <li>总资产一目了然，实时统计</li>
          <li>各类资产占比清晰呈现</li>
          <li>持仓涨跌联动，动态更新</li>
        </ul>
      </div>
    )
  },
  {
    key: 'holding',
    icon: <StockOutlined />,
    title: '📈 持仓管理',
    content: (
      <div className="guide-content">
        <p>专业的股票持仓跟踪</p>
        <ul className="guide-list">
          <li>实时价格更新，涨跌幅一目了然</li>
          <li>成本价、盈亏、收益率精准计算</li>
          <li>多只股票统一管理，便捷操作</li>
        </ul>
      </div>
    )
  },
  {
    key: 'analysis',
    icon: <RobotOutlined />,
    title: '🤖 持仓智研',
    content: (
      <div className="guide-content">
        <p>智能股票分析助手</p>
        <ul className="guide-list">
          <li>独家分析框架，跟踪持仓动态</li>
          <li>结合市场行情给出持仓建议</li>
          <li>分析市场机会，发现投资方向</li>
        </ul>
      </div>
    )
  },
  {
    key: 'start',
    icon: <ThunderboltOutlined />,
    title: '🚀 快速开始',
    content: (
      <div className="guide-content">
        <p>三步开启您的财富管理之旅</p>
        <div className="guide-steps">
          <div className="guide-step-item">
            <div className="guide-step-num">1</div>
            <div className="guide-step-text">
              <strong>添加资产</strong>
              <span>进入资产管理，添加现金、银行卡等</span>
            </div>
          </div>
          <div className="guide-step-arrow">↓</div>
          <div className="guide-step-item">
            <div className="guide-step-num">2</div>
            <div className="guide-step-text">
              <strong>添加持仓</strong>
              <span>进入持仓管理，添加股票基金</span>
            </div>
          </div>
          <div className="guide-step-arrow">↓</div>
          <div className="guide-step-item">
            <div className="guide-step-num">3</div>
            <div className="guide-step-text">
              <strong>查看总览</strong>
              <span>在总览页查看全部资产总和</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
]

interface OnboardingGuideProps {
  onComplete?: () => void
}

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const { user, isNewUser, clearNewUserFlag } = useAuthStore()
  const prevAuthRef = useRef(false)

  // 监听用户登录状态变化
  useEffect(() => {
    const wasUnauthenticated = !prevAuthRef.current
    const isNowAuthenticated = !!user

    // 从未登录变为已登录
    if (wasUnauthenticated && isNowAuthenticated) {
      const userId = user!.id
      const storageKey = getStorageKey(userId)
      const hasCompleted = localStorage.getItem(storageKey) === 'true'

      // 新用户 或 未完成过引导 的用户都显示
      if (isNewUser || !hasCompleted) {
        setIsVisible(true)
        setCurrentStep(0)
        // 清除新用户标记
        if (isNewUser) {
          clearNewUserFlag()
        }
      }
    }

    prevAuthRef.current = isNowAuthenticated

    // 用户登出时隐藏
    if (!isNowAuthenticated) {
      setIsVisible(false)
    }
  }, [user, isNewUser, clearNewUserFlag])

  const handleComplete = () => {
    if (user) {
      localStorage.setItem(getStorageKey(user.id), 'true')
    }
    setIsVisible(false)
    onComplete?.()
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleNext = () => {
    if (currentStep < GUIDE_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  // ESC 键关闭
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  if (!isVisible) return null

  const step = GUIDE_STEPS[currentStep]
  const isLastStep = currentStep === GUIDE_STEPS.length - 1
  const isFirstStep = currentStep === 0

  return (
    <>
      <div className="guide-overlay">
        <div className="guide-card">
          <div className="guide-card-header">
            <div className="guide-progress">
              {GUIDE_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`guide-progress-dot ${index <= currentStep ? 'active' : ''}`}
                />
              ))}
            </div>
            <button className="guide-close" onClick={handleSkip}>
              <CloseOutlined />
            </button>
          </div>

          <div className="guide-icon">{step.icon}</div>

          <h2 className="guide-title">{step.title}</h2>

          <div className="guide-body">
            {step.content}
          </div>

          <div className="guide-footer">
            {!isFirstStep && (
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={handlePrev}
                className="guide-btn guide-btn-prev"
              >
                上一步
              </Button>
            )}

            <Button
              type="primary"
              icon={isLastStep ? null : <ArrowRightOutlined />}
              onClick={handleNext}
              className="guide-btn guide-btn-next"
            >
              {isLastStep ? '开始使用' : '下一步'}
            </Button>
          </div>

          <div className="guide-step-count">
            {currentStep + 1} / {GUIDE_STEPS.length}
          </div>
        </div>

        <div className="guide-skip-hint">
          按 <kbd>ESC</kbd> 或点击 <button onClick={handleSkip}>跳过</button> 关闭
        </div>
      </div>

      <style>{`
        .guide-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: guideFadeIn 0.3s ease;
        }

        @keyframes guideFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .guide-card {
          position: relative;
          background: var(--card-bg);
          border-radius: 16px;
          padding: 32px;
          max-width: 440px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: guideSlideUp 0.4s ease;
        }

        @keyframes guideSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .guide-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .guide-progress {
          display: flex;
          gap: 6px;
        }

        .guide-progress-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--card-border);
          transition: all 0.3s ease;
        }

        .guide-progress-dot.active {
          background: var(--brand-500);
          width: 20px;
          border-radius: 4px;
        }

        .guide-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .guide-close:hover {
          background: var(--card-border);
          color: var(--text-primary);
        }

        .guide-icon {
          font-size: 44px;
          text-align: center;
          margin-bottom: 14px;
          color: var(--brand-500);
        }

        .guide-emoji {
          font-size: 52px;
        }

        .guide-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
          text-align: center;
          margin-bottom: 18px;
        }

        .guide-body {
          margin-bottom: 24px;
        }

        .guide-content {
          text-align: center;
        }

        .guide-content > p {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .guide-highlight {
          color: var(--brand-500) !important;
          font-weight: 500;
        }

        .guide-list {
          text-align: left;
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .guide-list li {
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.8;
          padding-left: 24px;
          position: relative;
        }

        .guide-list li::before {
          content: '•';
          position: absolute;
          left: 8px;
          color: var(--brand-500);
          font-weight: bold;
        }

        /* 三步流程 */
        .guide-steps {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .guide-step-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: var(--app-bg);
          border-radius: 10px;
          text-align: left;
        }

        .guide-step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--brand-500);
          color: white;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .guide-step-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .guide-step-text strong {
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 500;
        }

        .guide-step-text span {
          color: var(--text-tertiary);
          font-size: 11px;
        }

        .guide-step-arrow {
          text-align: center;
          color: var(--text-tertiary);
          font-size: 12px;
          line-height: 1;
        }

        .guide-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .guide-btn {
          height: 38px;
          padding: 0 22px;
          border-radius: 19px;
          font-weight: 500;
        }

        .guide-btn-prev {
          color: var(--text-secondary);
        }

        .guide-btn-next {
          background: var(--brand-500);
          border-color: var(--brand-500);
          min-width: 100px;
        }

        .guide-btn-next:hover {
          background: var(--brand-600) !important;
          border-color: var(--brand-600) !important;
        }

        .guide-step-count {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .guide-skip-hint {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
        }

        .guide-skip-hint kbd {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: inherit;
        }

        .guide-skip-hint button {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          text-decoration: underline;
        }

        /* 移动端适配 */
        @media (max-width: 480px) {
          .guide-card {
            padding: 24px 20px;
            margin: 16px;
          }

          .guide-icon {
            font-size: 36px;
          }

          .guide-title {
            font-size: 17px;
          }

          .guide-steps {
            gap: 2px;
          }
        }
      `}</style>
    </>
  )
}

export function resetOnboarding(userId?: string) {
  if (userId) {
    localStorage.removeItem(getStorageKey(userId))
  } else {
    // 清除所有用户的引导标记
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  }
}
