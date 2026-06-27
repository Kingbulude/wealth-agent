import { useState, useEffect } from 'react'
import { Button } from 'antd'
import { AreaChartOutlined, RobotOutlined, ThunderboltOutlined, CloseOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons'

const STORAGE_KEY = 'wealth_agent_onboarding_done'

interface GuideStep {
  key: string
  icon: React.ReactNode
  title: string
  content: React.ReactNode
  highlight?: string // 需要高亮的元素选择器
}

const GUIDE_STEPS: GuideStep[] = [
  {
    key: 'welcome',
    icon: <span className="guide-emoji">👋</span>,
    title: '欢迎使用「持仓智研」',
    content: (
      <div className="guide-content">
        <p>一个专注于个人财富管理的智能助手</p>
        <p className="guide-highlight">帮助您跟踪持仓、分析市场、发现机会</p>
      </div>
    )
  },
  {
    key: 'wealth',
    icon: <AreaChartOutlined />,
    title: '📊 财富分布',
    content: (
      <div className="guide-content">
        <p>可视化展示您的资产配置</p>
        <ul className="guide-list">
          <li>支持股票、基金、现金等多资产类别</li>
          <li>持仓实时联动，涨跌一目了然</li>
          <li>直观了解资产集中度和风险分布</li>
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
        <p>点击「<strong>添加持仓</strong>」添加您的第一只股票</p>
        <p className="guide-highlight">系统将自动追踪价格变化并分析机会</p>
        <div className="guide-demo">
          <div className="guide-demo-item">
            <span className="guide-demo-num">1</span>
            <span>进入持仓管理</span>
          </div>
          <div className="guide-demo-arrow">→</div>
          <div className="guide-demo-item">
            <span className="guide-demo-num">2</span>
            <span>点击添加按钮</span>
          </div>
          <div className="guide-demo-arrow">→</div>
          <div className="guide-demo-item">
            <span className="guide-demo-num">3</span>
            <span>输入股票代码</span>
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

  useEffect(() => {
    // 检查是否已完成过引导
    const hasCompleted = localStorage.getItem(STORAGE_KEY) === 'true'
    if (!hasCompleted) {
      setIsVisible(true)
    }
  }, [])

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
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

  if (!isVisible) return null

  const step = GUIDE_STEPS[currentStep]
  const isLastStep = currentStep === GUIDE_STEPS.length - 1
  const isFirstStep = currentStep === 0

  return (
    <>
      {/* 遮罩层 */}
      <div className="guide-overlay">
        {/* 内容卡片 */}
        <div className="guide-card">
          {/* 顶部装饰 */}
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

          {/* 图标 */}
          <div className="guide-icon">{step.icon}</div>

          {/* 标题 */}
          <h2 className="guide-title">{step.title}</h2>

          {/* 内容 */}
          <div className="guide-body">
            {step.content}
          </div>

          {/* 底部导航 */}
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
        </div>

        {/* 底部跳过提示 */}
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
          background: var(--card-bg);
          border-radius: 16px;
          padding: 32px;
          max-width: 420px;
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
          margin-bottom: 24px;
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
          width: 24px;
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
          font-size: 48px;
          text-align: center;
          margin-bottom: 16px;
        }

        .guide-emoji {
          font-size: 56px;
        }

        .guide-title {
          font-size: 22px;
          font-weight: 600;
          color: var(--text-primary);
          text-align: center;
          margin-bottom: 20px;
        }

        .guide-body {
          margin-bottom: 28px;
        }

        .guide-content {
          text-align: center;
        }

        .guide-content p {
          color: var(--text-secondary);
          font-size: 15px;
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
          font-size: 14px;
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

        .guide-demo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 20px;
          padding: 16px;
          background: var(--app-bg);
          border-radius: 12px;
        }

        .guide-demo-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .guide-demo-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--brand-500);
          color: white;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .guide-demo-item span:last-child {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .guide-demo-arrow {
          color: var(--text-tertiary);
          font-size: 16px;
        }

        .guide-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .guide-btn {
          height: 40px;
          padding: 0 24px;
          border-radius: 20px;
          font-weight: 500;
        }

        .guide-btn-prev {
          color: var(--text-secondary);
        }

        .guide-btn-next {
          background: var(--brand-500);
          border-color: var(--brand-500);
        }

        .guide-btn-next:hover {
          background: var(--brand-600) !important;
          border-color: var(--brand-600) !important;
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
            padding: 24px;
            margin: 16px;
          }

          .guide-icon {
            font-size: 40px;
          }

          .guide-title {
            font-size: 18px;
          }

          .guide-demo {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </>
  )
}

// 导出重置引导的函数（用于测试或重置）
export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
}
