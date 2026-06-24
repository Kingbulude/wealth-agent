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
  ThunderboltOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  RobotOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../renderer/stores/authStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAssetStore } from '../stores/assetStore'
import { useNavigate } from 'react-router-dom'
import PortfolioOverview from '../components/PortfolioOverview'
import AssetList from '../components/AssetList'
import HoldingList from '../components/HoldingList'
import AIAdvisor from '../components/AIAdvisor'

const TABS = [
  { key: 'overview',   label: '资产总览', icon: <AppstoreOutlined /> },
  { key: 'management', label: '资产管理', icon: <DatabaseOutlined /> },
  { key: 'holdings',   label: '持仓管理', icon: <LineChartOutlined /> },
  { key: 'advisor',    label: 'AI 投顾',  icon: <RobotOutlined /> }
]

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { refreshPrices, refreshing, holdings } = useHoldingStore()
  const { loadAssets } = useAssetStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    refreshPrices()
    autoRefreshTimer.current = setInterval(() => {
      refreshPrices()
    }, 300_000) // 5分钟

    const handler = (e: any) => {
      if (e.detail?.key) setActiveTab(e.detail.key)
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
    if (key === 'holdings') refreshPrices()
    if (key === 'overview' || key === 'management') {
      loadAssets()
      refreshPrices()
    }
  }

  const userInitial = (user?.email || 'U').charAt(0).toUpperCase()
  const portfolioCount = holdings.length

  // 计算大盘指数展示（mock - 实际可对接新浪/东财指数）
  const shIndex = { val: 3_248.66, change: 0.42 }
  const szIndex = { val: 10_412.18, change: -0.18 }

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
          <div className="ticker-pill">
            <span className="label">上证</span>
            <span className="val">{shIndex.val.toLocaleString()}</span>
            <span className={shIndex.change >= 0 ? 'up' : 'down'}>
              {shIndex.change >= 0 ? '▲' : '▼'} {Math.abs(shIndex.change).toFixed(2)}%
            </span>
          </div>
          <div className="ticker-pill">
            <span className="label">深证</span>
            <span className="val">{szIndex.val.toLocaleString()}</span>
            <span className={szIndex.change >= 0 ? 'up' : 'down'}>
              {szIndex.change >= 0 ? '▲' : '▼'} {Math.abs(szIndex.change).toFixed(2)}%
            </span>
          </div>
          <div className="ticker-pill">
            <span className="label">持仓</span>
            <span className="val num">{portfolioCount}</span>
            <span className="label">只</span>
          </div>
          {refreshing && (
            <div className="ticker-pill">
              <span className="live-dot busy" />
              <span className="label">同步中</span>
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
        <div className="fade-in-2">
          {activeTab === 'overview'   && <PortfolioOverview />}
          {activeTab === 'management' && <AssetList />}
          {activeTab === 'holdings'   && <HoldingList />}
          {activeTab === 'advisor'    && <AIAdvisor />}
        </div>
      </main>
    </div>
  )
}
