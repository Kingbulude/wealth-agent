import { create } from 'zustand'
import { Holding, HoldingFormData } from '../types/holding'
import { useAuthStore } from '../renderer/stores/authStore'
import { fetchBatchPrices, isValidPrice } from '../services/stockService'
import { getApiUrl } from '../utils/apiUrl'

function getUserId(): string {
  const user = useAuthStore.getState().user
  return user?.email || user?.id || ''
}

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

interface HoldingState {
  holdings: Holding[]
  loading: boolean
  refreshing: boolean
  syncedAt: string | null
  lastPriceUpdate: string | null

  loadHoldings: () => Promise<void>
  addHolding: (data: HoldingFormData) => Promise<void>
  addSampleHolding: (data: HoldingFormData, currentPrice: number) => Promise<void>
  updateHolding: (id: string, data: Partial<HoldingFormData>) => Promise<void>
  deleteHolding: (id: string) => Promise<void>
  getHoldingsByType: (type: 'stock' | 'fund' | 'all') => Holding[]
  getTotalValue: (type?: 'stock' | 'fund') => number
  getTotalProfit: (type?: 'stock' | 'fund') => number
  getTotalCost: (type?: 'stock' | 'fund') => number
  getProfitRate: (type?: 'stock' | 'fund') => number
  refreshPrices: () => Promise<{ successCount: number; totalCount: number } | undefined>
  fetchPriceFor: (type: 'stock' | 'fund', symbol: string) => Promise<{ price: number; name?: string } | null>
}

export const useHoldingStore = create<HoldingState>()((set, get) => ({
  holdings: [],
  loading: false,
  refreshing: false,
  syncedAt: null,
  lastPriceUpdate: null,

  loadHoldings: async () => {
    set({ loading: true })
    try {
      const resp = await apiFetch('/holdings')
      if (resp.ok) {
        const json = await resp.json()
        if (json.ok && Array.isArray(json.data)) {
          set({ holdings: json.data, syncedAt: new Date().toISOString() })
          return
        }
      }
      set({ holdings: [] })
    } catch (e) {
      console.warn('[holdings] 加载云端失败:', e)
      set({ holdings: [] })
    } finally {
      set({ loading: false })
    }
  },

  addHolding: async (data: HoldingFormData) => {
    const newHolding: Holding = {
      id: crypto.randomUUID(),
      userId: getUserId(),
      type: data.type,
      symbol: String(data.symbol).trim(),
      name: data.name || data.symbol,
      quantity: data.quantity,
      avgCost: data.avgCost,
      currentPrice: data.currentPrice || data.avgCost,
      lastUpdated: new Date().toISOString()
    }

    const resp = await apiFetch('/holdings', { method: 'POST', body: JSON.stringify(newHolding) })
    if (resp.ok && (await resp.json()).ok) {
      set(state => ({
        holdings: [...state.holdings, newHolding],
        syncedAt: new Date().toISOString()
      }))
    } else {
      throw new Error('添加持仓失败')
    }
  },

  updateHolding: async (id: string, data: Partial<HoldingFormData>) => {
    const holdings = get().holdings.map(h => {
      if (h.id === id) {
        const { isSample, ...rest } = h
        return { ...rest, ...data, lastUpdated: new Date().toISOString() }
      }
      return h
    })

    const updated = holdings.find(h => h.id === id)
    if (updated) {
      const resp = await apiFetch(`/holdings/${id}`, { method: 'PUT', body: JSON.stringify(updated) })
      if (resp.ok && (await resp.json()).ok) {
        set({ holdings, syncedAt: new Date().toISOString() })
      } else {
        throw new Error('更新持仓失败')
      }
    }
  },

  addSampleHolding: async (data: HoldingFormData, currentPrice: number) => {
    const newHolding: Holding = {
      id: crypto.randomUUID(),
      userId: getUserId(),
      type: data.type,
      symbol: String(data.symbol).trim(),
      name: data.name || data.symbol,
      quantity: data.quantity,
      avgCost: data.avgCost,
      currentPrice: currentPrice || data.avgCost,
      isSample: true,
      lastUpdated: new Date().toISOString()
    }

    const resp = await apiFetch('/holdings', { method: 'POST', body: JSON.stringify(newHolding) })
    if (resp.ok && (await resp.json()).ok) {
      set(state => ({
        holdings: [...state.holdings, newHolding],
        syncedAt: new Date().toISOString()
      }))
    }
  },

  deleteHolding: async (id: string) => {
    const resp = await apiFetch(`/holdings/${id}`, { method: 'DELETE' })
    if (resp.ok) {
      set(state => ({
        holdings: state.holdings.filter(h => h.id !== id),
        syncedAt: new Date().toISOString()
      }))
    } else {
      throw new Error('删除持仓失败')
    }
  },

  getHoldingsByType: (type: 'stock' | 'fund' | 'all') => {
    if (type === 'all') return get().holdings
    return get().holdings.filter(h => h.type === type)
  },

  getTotalValue: (type?: 'stock' | 'fund') => {
    const list = type ? get().getHoldingsByType(type) : get().holdings
    return list.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0)
  },

  getTotalCost: (type?: 'stock' | 'fund') => {
    const list = type ? get().getHoldingsByType(type) : get().holdings
    return list.reduce((sum, h) => sum + h.quantity * h.avgCost, 0)
  },

  getTotalProfit: (type?: 'stock' | 'fund') => {
    return get().getTotalValue(type) - get().getTotalCost(type)
  },

  getProfitRate: (type?: 'stock' | 'fund') => {
    const cost = get().getTotalCost(type)
    if (cost === 0) return 0
    return (get().getTotalProfit(type) / cost) * 100
  },

  refreshPrices: async () => {
    set({ refreshing: true })
    try {
      const holdings = get().holdings
      if (holdings.length === 0) {
        set({ refreshing: false })
        return { successCount: 0, totalCount: 0 }
      }

      const result = await fetchBatchPrices(
        holdings.map(h => ({ type: h.type, symbol: h.symbol }))
      )

      const updated = holdings.map(h => {
        const found = result.prices.get(h.symbol)
        const newPrice = found?.price
        const prevClose = found?.prevClose
        if (
          newPrice &&
          newPrice > 0 &&
          isValidPrice(newPrice, prevClose && prevClose > 0 ? prevClose : undefined)
        ) {
          let changePercent = found.changePercent
          let change = found.change
          if (
            prevClose && prevClose > 0 &&
            (changePercent === undefined || changePercent === null || Math.abs(changePercent) > 30)
          ) {
            change = newPrice - prevClose
            changePercent = (change / prevClose) * 100
          }
          return {
            ...h,
            currentPrice: newPrice,
            currentChangePercent: changePercent,
            currentChange: change,
            name: found?.name || h.name,
            lastUpdated: new Date().toISOString()
          }
        }
        return h
      })

      set({ holdings: updated, lastPriceUpdate: new Date().toISOString() })

      const resp = await apiFetch('/holdings/sync', {
        method: 'PUT',
        body: JSON.stringify({ holdings: updated })
      })
      if (resp.ok) {
        const json = await resp.json().catch(() => null)
        if (json?.ok) set({ syncedAt: new Date().toISOString() })
        else console.warn('同步价格到 API 失败：', json?.error || '未知错误')
      } else {
        console.warn(`同步价格到 API 失败：HTTP ${resp.status}`)
      }

      return { successCount: result.successCount, totalCount: result.totalCount }
    } catch (error) {
      console.error('刷新价格失败:', error)
      return { successCount: 0, totalCount: get().holdings.length }
    } finally {
      set({ refreshing: false })
    }
  },

  fetchPriceFor: async (type: 'stock' | 'fund', symbol: string) => {
    const r = await fetchBatchPrices([{ type, symbol }])
    return r.prices.get(symbol) || null
  }
}))