// 持仓汇总 Store —— 单数据源，所有 Tab 共用
// 职责：
//   1) 优先从 /api/portfolio/summary 拉取（后端统一计算）
//   2) 后端失败时降级：从 holdingStore 读 + 本地计算
//   3) 提供 computed 字段（单条市值/盈亏）
//   4) 定时轮询行情（300秒）
//   5) 持仓管理写入后主动刷新

import { create } from 'zustand'
import { useHoldingStore } from './holdingStore'
import { useAuthStore } from '../renderer/stores/authStore'
import { fetchStockPrice } from '../services/stockService'
import { getApiUrl } from '../utils/apiUrl'

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
  const token = useAuthStore.getState().token
  return fetch(getApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
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
   * 优先调后端 /api/portfolio/summary，失败则降级到本地计算
   * 注意：降级计算依赖 holdingStore 中的持仓数据，先确保已加载
   */
  loadPortfolio: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      // 先确保持仓数据已加载（降级计算需要用到）
      await useHoldingStore.getState().loadHoldings()

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
      console.warn('[portfolio] 后端接口失败，降级本地计算:', e.message)
      // 降级：从 holdingStore 本地计算
      try {
        const localData = await calculateFromHoldings()
        set({
          data: localData,
          loading: false,
          lastFetchedAt: new Date().toISOString(),
          error: null // 降级成功就不显示错误
        })
      } catch (e2: any) {
        console.error('[portfolio] loadPortfolio 全部失败:', e2)
        set({ loading: false, error: e2.message || '加载失败' })
      }
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
      // 后端失败，降级本地刷新
      console.warn('[portfolio] refreshPrices 后端失败，降级本地计算')
      const localData = await calculateFromHoldings()
      set({
        data: localData,
        refreshing: false,
        lastFetchedAt: new Date().toISOString()
      })
    } catch (e) {
      console.warn('[portfolio] refreshPrices failed:', e)
      // 即使失败也尝试降级
      try {
        const localData = await calculateFromHoldings()
        set({ data: localData, refreshing: false, lastFetchedAt: new Date().toISOString() })
      } catch {
        set({ refreshing: false })
      }
    }
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

// ==================== 降级：从 holdingStore 本地计算 ====================
// 当后端 /api/portfolio/summary 不可用时，使用本地数据计算
async function calculateFromHoldings(): Promise<PortfolioData> {
  const holdings = useHoldingStore.getState().holdings

  // 先刷新一下行情（如果还没刷新过）
  try {
    const lastUpdate = useHoldingStore.getState().lastPriceUpdate
    const stale = !lastUpdate || Date.now() - new Date(lastUpdate).getTime() > 60_000
    if (stale && holdings.length > 0) {
      await useHoldingStore.getState().refreshPrices()
    }
  } catch {}

  const freshHoldings = useHoldingStore.getState().holdings

  const holdingDetails: HoldingDetail[] = freshHoldings.map(h => {
    const currentPrice = h.currentPrice || h.avgCost || 0
    const marketValue = currentPrice * h.quantity
    const cost = h.avgCost * h.quantity
    const profit = marketValue - cost
    const profitPercent = cost > 0 ? (profit / cost) * 100 : 0
    const changePercent = h.currentPrice && h.avgCost
      ? ((h.currentPrice - h.avgCost) / h.avgCost) * 100
      : 0

    return {
      id: h.id,
      type: h.type,
      symbol: h.symbol,
      name: h.name,
      quantity: h.quantity,
      avgCost: h.avgCost,
      currentPrice,
      marketValue,
      cost,
      profit,
      profitPercent,
      changePercent,
      prevClose: h.currentPrice || h.avgCost,
      high: 0,
      low: 0,
      updateTime: h.lastUpdated || '',
      lastUpdated: h.lastUpdated || ''
    }
  })

  const totalMarketValue = holdingDetails.reduce((s, h) => s + h.marketValue, 0)
  const totalCost = holdingDetails.reduce((s, h) => s + h.cost, 0)
  const totalProfit = totalMarketValue - totalCost
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

  const stockHoldings = holdingDetails.filter(h => h.type === 'stock')
  const fundHoldings = holdingDetails.filter(h => h.type === 'fund')

  function buildTypeSummary(list: HoldingDetail[]): TypeSummary {
    const marketValue = list.reduce((s, h) => s + h.marketValue, 0)
    const cost = list.reduce((s, h) => s + h.cost, 0)
    const profit = marketValue - cost
    const profitPercent = cost > 0 ? (profit / cost) * 100 : 0
    return {
      count: list.length,
      marketValue,
      cost,
      profit,
      profitPercent,
      holdings: list
    }
  }

  return {
    holdings: holdingDetails,
    summary: {
      totalMarketValue,
      totalCost,
      totalProfit,
      totalProfitPercent,
      stockCount: stockHoldings.length,
      fundCount: fundHoldings.length,
      updateTime: new Date().toISOString()
    },
    byType: {
      stock: buildTypeSummary(stockHoldings),
      fund: buildTypeSummary(fundHoldings)
    }
  }
}
