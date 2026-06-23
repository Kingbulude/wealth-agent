// 持仓汇总 Store —— 单数据源，所有 Tab 共用
// 职责：
//   1) 从 /api/portfolio/summary 拉取持仓+行情+汇总数据
//   2) 提供 computed 字段（单条市值/盈亏已在后端算好）
//   3) 定时轮询行情（300秒）
//   4) 持仓管理写入后主动刷新

import { create } from 'zustand'

export interface HoldingDetail {
  id: string
  type: 'stock' | 'fund'
  symbol: string
  name: string
  quantity: number
  avgCost: number       // 成本价
  currentPrice: number  // 当前价（实时）
  marketValue: number   // 市值 = currentPrice × quantity
  cost: number          // 总成本 = avgCost × quantity
  profit: number        // 浮动盈亏 = marketValue - cost
  profitPercent: number // 盈亏比例（%）
  changePercent: number // 涨跌幅（%）
  prevClose: number
  high: number
  low: number
  updateTime: string
  lastUpdated: string
}

export interface TypeSummary {
  count: number
  marketValue: number
  cost: number
  profit: number
  profitPercent: number
  holdings: HoldingDetail[]
}

export interface PortfolioSummary {
  totalMarketValue: number  // 总市值
  totalCost: number         // 总成本
  totalProfit: number       // 总浮动盈亏
  totalProfitPercent: number
  stockCount: number
  fundCount: number
  updateTime: string
}

export interface PortfolioData {
  holdings: HoldingDetail[]
  summary: PortfolioSummary
  byType: {
    stock: TypeSummary
    fund: TypeSummary
  }
}

interface PortfolioState {
  data: PortfolioData | null
  loading: boolean
  refreshing: boolean
  lastFetchedAt: string | null
  error: string | null
  _refreshTimer: ReturnType<typeof setInterval> | null

  loadPortfolio: () => Promise<void>
  refreshPrices: () => Promise<void>
  startAutoRefresh: () => void
  stopAutoRefresh: () => void
}

// 每个活跃用户共享同一个刷新周期（300秒 = 5分钟）
let sharedRefreshTimer: ReturnType<typeof setInterval> | null = null
let sharedRefreshCount = 0 // 防止多个实例同时刷新

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('wealth_agent_email') || ''}`,
      ...(options.headers || {})
    }
  })
}

export const usePortfolioStore = create<PortfolioState>()((set, get) => ({
  data: null,
  loading: false,
  refreshing: false,
  lastFetchedAt: null,
  error: null,
  _refreshTimer: null,

  /**
   * 拉取完整持仓汇总数据
   */
  loadPortfolio: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const resp = await apiFetch('/portfolio/summary')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      if (!json.ok) throw new Error(json.error || '加载失败')
      set({
        data: json.data,
        loading: false,
        lastFetchedAt: new Date().toISOString(),
        error: null
      })
    } catch (e: any) {
      console.error('[portfolio] loadPortfolio failed:', e)
      set({ loading: false, error: e.message || '加载失败' })
    }
  },

  /**
   * 重新拉取行情（不显示 loading，只静默更新）
   */
  refreshPrices: async () => {
    if (get().refreshing) return
    // 多个组件同时调用时，只让第一个真正执行
    if (sharedRefreshCount > 0) return
    sharedRefreshCount++
    set({ refreshing: true })
    try {
      const resp = await apiFetch('/portfolio/summary')
      if (resp.ok) {
        const json = await resp.json()
        if (json.ok) {
          set({
            data: json.data,
            refreshing: false,
            lastFetchedAt: new Date().toISOString(),
            error: null
          })
          sharedRefreshCount = 0
          return
        }
      }
    } catch (e) {
      console.warn('[portfolio] refreshPrices failed:', e)
    }
    set({ refreshing: false })
    sharedRefreshCount = 0
  },

  /**
   * 启动定时轮询（300秒 = 5分钟）
   * 全局共享一个 timer，所有组件共享同一个刷新状态
   */
  startAutoRefresh: () => {
    if (sharedRefreshTimer) return // 已启动，不再重复
    // 立即拉一次
    get().loadPortfolio()
    sharedRefreshTimer = setInterval(() => {
      get().refreshPrices()
    }, 300_000) // 300 秒
  },

  /**
   * 停止定时轮询（页面卸载时调用）
   */
  stopAutoRefresh: () => {
    if (sharedRefreshTimer) {
      clearInterval(sharedRefreshTimer)
      sharedRefreshTimer = null
    }
  }
}))
