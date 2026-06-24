// 财富管理智能体 — 主页面（深色顶栏 + Pill Tab）
// 设计风格：Modern Wealth Terminal
// 数据流：
//   - 资产总览：assetStore + holdingStore（持仓联动合并）
//   - 资产管理：assetStore + holdingStore（持仓联动合并）
//   - 持仓管理：holdingStore（唯一写入端）
//   - AI投顾：读取 assetStore + holdingStore 做上下文

import { useState, useEffect, useRef } from 'react'
import { message, Tooltip } from 'antd'
import {
  ReloadOutlined,
  LogoutOutlined,
  BellOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../renderer/stores/authStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAssetStore } from '../stores/assetStore'
import { useNavigate } from 'react-router-dom'
import PortfolioOverview from '../components/PortfolioOverview'
import AssetList from '../components/AssetList'
import HoldingList from '../components/HoldingList'
import AIAdvisor from '../components/AIAdvisor'
import { fetchIndexQuotes, type IndexQuote } from '../services/stockService'

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
    <path d="M4 20V10" strokeWidth="1.6" />
    <rect x="2.5" y="13" width="3" height="7" rx="0.8" fill="currentColor" opacity="0.15" stroke="none" />
    <path d="M10 20V4" strokeWidth="1.6" />
    <rect x="8.5" y="7" width="3" height="13" rx="0.8" fill="currentColor" opacity="0.15" stroke="none" />
    <path d="M16 20V8" strokeWidth="1.6" />
    <rect x="14.5" y="11" width="3" height="9" rx="0.8" fill="currentColor" opacity="0.15" stroke="none" />
    <path d="M22 20L18 12" strokeWidth="1.6" />
    <circle cx="21" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const TabIconAI = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
    <rect x="4" y="4" width="16" height="16" rx="4" strokeWidth="1.6" />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <path d="M8.5 15c1 1.5 6 1.5 7 0" strokeWidth="1.6" />
    <path d="M12 2v1M12 21v1M2 12h1M21 12h1" strokeWidth="1.2" opacity="0.6" />
    <circle cx="6" cy="6" r="0.8" fill="currentColor" stroke="none" opacity="0.5" />
    <circle cx="18" cy="6" r="0.8" fill="currentColor" stroke="none" opacity="0.5" />
    <circle cx="6" cy="18" r="0.8" fill="currentColor" stroke="none" opacity="0.5" />
    <circle cx="18" cy="18" r="0.8" fill="currentColor" stroke="none" opacity="0.5" />
  </svg>
)

const TABS = [
  { key: 'overview',   label: '资产总览', icon: <TabIconOverview /> },
  { key: 'management', label: '资产管理', icon: <TabIconAssets /> },
  { key: 'holdings',   label: '持仓管理', icon: <TabIconHoldings /> },
  { key: 'advisor',    label: 'AI 投顾',  icon: <TabIconAI /> }
]

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { refreshPrices, refreshing, holdings } = useHoldingStore()
  const { loadAssets } = useAssetStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [indexQuotes, setIndexQuotes] = useState<IndexQuote[]>([])
  const [indexLoading, setIndexLoading] = useState(true)
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

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'holdings') refreshPrices()
    if (key === 'overview' || key === 'management') {
      loadAssets()
      refreshPrices()
    }
  }

  const userInitial = (user?.email || 'U').charAt(0).toUpperCase()
  const portfolioCount = holdings.length

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
          {activeTab === 'overview'   && <PortfolioOverview />}
          {activeTab === 'management' && <AssetList />}
          {activeTab === 'holdings'   && <HoldingList />}
          {activeTab === 'advisor'    && <AIAdvisor />}
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
    </div>
  )
}
