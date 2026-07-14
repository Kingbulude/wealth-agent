// 财富管理智能体 — 主页面（深色顶栏 + Pill Tab）
// 设计风格：Modern Wealth Terminal
// 数据流：
//   - 资产总览：assetStore + holdingStore（持仓联动合并）
//   - 资产管理：assetStore + holdingStore（持仓联动合并）
//   - 持仓管理：holdingStore（唯一写入端）
//   - 持仓智研：读取 assetStore + holdingStore 做上下文

import { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { message, Tooltip, Spin } from 'antd'
import {
  ReloadOutlined,
  LogoutOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  SendOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../renderer/stores/authStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAssetStore } from '../stores/assetStore'
import { useNavigate } from 'react-router-dom'
import SettingsPanel from '../components/SettingsPanel'
import { fetchIndexQuotes, type IndexQuote } from '../services/stockService'
import { sendFeishuPush, getPushConfig } from '../services/notificationService'

// 懒加载各 Tab 组件（减少首屏 JS 体积）
const PortfolioOverview = lazy(() => import('../components/PortfolioOverview'))
const AssetList = lazy(() => import('../components/AssetList'))
const HoldingList = lazy(() => import('../components/HoldingList'))
const AIAdvisor = lazy(() => import('../components/AIAdvisor'))

const TabFallback = () => (
  <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" tip="加载中..." />
  </div>
)

/* Modern Tab Icons (Tech + Wealth style) */
const TabIconOverview = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
    <path d="M12 3v4" strokeWidth="1.6" />
    <path d="M12 17v4" strokeWidth="1.6" />
    <path d="M3 12h4" strokeWidth="1.6" />
    <path d="M17 12h4" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="6.5" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" opacity="0.2" />
    <path d="M12 9v3l2 2" strokeWidth="1.8" />
  </svg>
)

const TabIconAssets = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
    <rect x="3" y="7" width="18" height="13" rx="2" strokeWidth="1.6" />
    <path d="M3 10h18" strokeWidth="1.6" />
    <circle cx="12" cy="14.5" r="2.2" strokeWidth="1.6" />
    <path d="M8 4h8l1 3H7L8 4z" strokeWidth="1.6" />
    <path d="M10.5 14.5h3" strokeWidth="1.4" opacity="0.5" />
  </svg>
)

const TabIconHoldings = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
    <path d="M3 7h18v11H3z" strokeWidth="1.6" />
    <path d="M3 10h18" strokeWidth="1.6" />
    <path d="M7 14l2 2 4-4" strokeWidth="1.8" />
    <circle cx="17" cy="15" r="1" fill="currentColor" stroke="none" opacity="0.6" />
    <path d="M8 3h8l1 3H7L8 3z" strokeWidth="1.6" />
  </svg>
)

const TabIconAI = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
    <path d="M12 2L3 7v6c0 5 3.5 8.5 9 9 5.5-.5 9-4 9-9V7l-9-5z" strokeWidth="1.6" />
    <path d="M9 12l2 2 4-4" strokeWidth="1.8" />
    <path d="M7 7h10" strokeWidth="1.4" opacity="0.5" />
    <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" opacity="0.6" />
  </svg>
)

const TABS = [
  { key: 'overview',   label: '资产总览', icon: <TabIconOverview /> },
  { key: 'management', label: '资产管理', icon: <TabIconAssets /> },
  { key: 'holdings',   label: '持仓管理', icon: <TabIconHoldings /> },
  { key: 'advisor',    label: '持仓智研', icon: <TabIconAI /> }
]

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { refreshPrices, refreshing, holdings, loadHoldings } = useHoldingStore()
  const { loadAssets } = useAssetStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [indexQuotes, setIndexQuotes] = useState<IndexQuote[]>([])
  const [indexLoading, setIndexLoading] = useState(true)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [, setPushLoading] = useState(false)
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const indexTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadIndexQuotes = async () => {
    try {
      const quotes = await fetchIndexQuotes()
      if (quotes.length > 0) setIndexQuotes(quotes)
    } catch (e) {
      console.warn('[index] 大盘指数拉取失败:', e)
    } finally {
      setIndexLoading(false)
    }
  }

  useEffect(() => {
    // 进入 Dashboard 时从 API 同步最新数据（解决多设备数据不同步）
    loadAssets()
    loadHoldings()
    refreshPrices()
    loadIndexQuotes()
    autoRefreshTimer.current = setInterval(() => {
      refreshPrices()
    }, 300_000) // 5分钟
    indexTimer.current = setInterval(() => {
      loadIndexQuotes()
    }, 60_000) // 大盘指数 1 分钟刷新一次

    const handler = (e: any) => {
      if (e.detail?.key) setActiveTab(e.detail.key)
    }
    window.addEventListener('switch-tab', handler)

    return () => {
      if (autoRefreshTimer.current) {
        clearInterval(autoRefreshTimer.current)
        autoRefreshTimer.current = null
      }
      if (indexTimer.current) {
        clearInterval(indexTimer.current)
        indexTimer.current = null
      }
      window.removeEventListener('switch-tab', handler)
    }
  }, [])

  const handleLogout = () => {
    if (autoRefreshTimer.current) {
      clearInterval(autoRefreshTimer.current)
      autoRefreshTimer.current = null
    }
    if (indexTimer.current) {
      clearInterval(indexTimer.current)
      indexTimer.current = null
    }
    logout()
    message.success('已退出登录')
    navigate('/login')
  }

  const handleRefresh = async () => {
    message.info('正在刷新数据…')
    await Promise.all([refreshPrices(), loadAssets(), loadIndexQuotes()])
    message.success('刷新完成')
  }

  const handlePushPortfolio = async () => {
    const config = getPushConfig()
    if (!config.feishuWebhook) {
      message.warning('请先在设置中配置飞书Webhook')
      setSettingsVisible(true)
      return
    }

    setPushLoading(true)
    try {
      const totalValue = holdings.reduce((sum, h) => sum + (h.currentPrice * h.quantity || 0), 0)
      const totalCost = holdings.reduce((sum, h) => sum + (h.avgCost * h.quantity || 0), 0)
      const totalProfit = totalValue - totalCost
      const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

      let content = `📊 **持仓报告**\n\n`
      content += `📅 更新时间：${new Date().toLocaleString('zh-CN')}\n\n`
      content += `💰 **总资产**：¥${totalValue.toLocaleString()}\n`
      content += `📈 **总收益**：${totalProfit >= 0 ? '+' : ''}¥${totalProfit.toLocaleString()} (${totalProfitPercent >= 0 ? '+' : ''}${totalProfitPercent.toFixed(2)}%)\n\n`
      content += `---\n\n`
      content += `📋 **持仓明细**\n\n`

      holdings.forEach(h => {
        const marketValue = h.currentPrice * h.quantity
        const costValue = h.avgCost * h.quantity
        const profit = marketValue - costValue
        const profitPercent = costValue > 0 ? (profit / costValue) * 100 : 0
        content += `- **${h.name}** (${h.symbol})\n`
        content += `  持仓：${h.quantity}股\n`
        content += `  现价：¥${(h.currentPrice || 0).toFixed(2)}\n`
        content += `  成本：¥${(h.avgCost || 0).toFixed(2)}\n`
        content += `  盈亏：${profit >= 0 ? '+' : ''}¥${profit.toFixed(2)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)\n\n`
      })

      content += `---\n\n`
      content += `💡 数据仅供参考，不构成投资建议`

      const result = await sendFeishuPush('portfolio', content, '持仓报告')
      if (result.ok) {
        message.success('持仓报告已推送到飞书')
      } else {
        message.error(result.error || '推送失败')
      }
    } catch (e) {
      message.error('推送失败')
    } finally {
      setPushLoading(false)
    }
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'holdings') refreshPrices()
    if (key === 'overview' || key === 'management') {
      loadAssets()
      refreshPrices()
    }
  }

  const userInitial = (user?.email || 'U').charAt(0).toUpperCase()

  // 用真实指数数据，没有就用占位
  const shIndex = indexQuotes.find(q => q.code === 'sh000001')

  return (
    <div className="app-shell">
      {/* ===== Top Bar ===== */}
      <header className="app-topbar">
        <div className="brand-block">
          <div className="brand-mark">¥</div>
          <div className="brand-text">
            <span className="brand-title">Wealth Terminal</span>
            <span className="brand-sub">财富管理智能体</span>
          </div>
        </div>

        {/* Market Ticker */}
        <div className="market-ticker">
          <span className="ticker-slogan">禁加杠杆，复利变富</span>
          <div className="ticker-pill" title={shIndex?.updateTime ? `更新于 ${shIndex.updateTime}` : ''}>
            <span className="label">上证</span>
            {shIndex ? (
              <>
                <span className="val">{shIndex.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={`change ${shIndex.changePercent >= 0 ? 'up' : 'down'}`}>
                  {shIndex.changePercent >= 0 ? '+' : ''}{shIndex.change.toFixed(2)}
                  <span className="pct">
                    {shIndex.changePercent >= 0 ? '▲' : '▼'} {Math.abs(shIndex.changePercent).toFixed(2)}%
                  </span>
                </span>
              </>
            ) : (
              <span className="val muted">——</span>
            )}
          </div>
          {(refreshing || indexLoading) && (
            <div className="ticker-pill">
              <span className="live-dot busy" />
              <span className="label">{refreshing ? '同步中' : '加载指数…'}</span>
            </div>
          )}
        </div>

        <div className="user-block">
          <Tooltip title="实时刷新">
            <button
              onClick={handleRefresh}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: 6,
                display: 'flex'
              }}
            >
              <ReloadOutlined spin={refreshing} style={{ fontSize: 14 }} />
            </button>
          </Tooltip>
          <Tooltip title="推送持仓报告到飞书">
            <button
              onClick={handlePushPortfolio}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: 6,
                display: 'flex'
              }}
            >
              <SendOutlined style={{ fontSize: 14 }} />
            </button>
          </Tooltip>
          <Tooltip title="设置">
            <button
              onClick={() => setSettingsVisible(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: 6,
                display: 'flex'
              }}
            >
              <SettingOutlined style={{ fontSize: 14 }} />
            </button>
          </Tooltip>
          <span className="user-email">{user?.email}</span>
          <div className="user-avatar">{userInitial}</div>
          <Tooltip title="退出登录">
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                marginLeft: 2
              }}
            >
              <LogoutOutlined style={{ fontSize: 14 }} />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* ===== Main Container ===== */}
      <main style={{
        flex: 1,
        maxWidth: 1440,
        width: '100%',
        margin: '0 auto',
        padding: '28px 32px 40px'
      }}>
        {/* Tab Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="tab-bar fade-in">
            {TABS.map((t, idx) => (
              <div
                key={t.key}
                className={`tab-item ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => handleTabChange(t.key)}
              >
                {t.icon}
                <span>{t.label}</span>
                <span className="tab-num">0{idx + 1}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="fade-in-1">
            <span className="chip muted">
              <span className="dot" />
              数据本地优先 · 云端同步
            </span>
            <span className="chip ink">
              <ThunderboltOutlined style={{ fontSize: 11 }} />
              AI 增强
            </span>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content-wrapper" key={activeTab}>
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'overview'   && <PortfolioOverview />}
            {activeTab === 'management' && <AssetList />}
            {activeTab === 'holdings'   && <HoldingList />}
            {activeTab === 'advisor'    && <AIAdvisor />}
          </Suspense>
        </div>
      </main>

      {/* ===== Mobile Bottom Tab Bar ===== */}
      <nav className="mobile-tab-bar">
        {TABS.map(t => {
          const isActive = activeTab === t.key
          return (
            <div
              key={t.key}
              className={`mobile-tab-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabChange(t.key)}
            >
              <span className="mobile-tab-icon">{t.icon}</span>
              <span className="mobile-tab-label">{t.label}</span>
            </div>
          )
        })}
      </nav>

      {/* Settings Modal */}
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </div>
  )
}
