import { create } from 'zustand'
import { Holding, HoldingFormData } from '../types/holding'
import { useAuthStore } from '../renderer/stores/authStore'
import { fetchBatchPrices, isValidPrice } from '../services/stockService'

const STORAGE_KEY = 'wealth_agent_holdings'

function getUserEmail(): string {
  return useAuthStore.getState().user?.email || ''
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

// ==================== 本地降级 ====================
function loadLocalHoldings(): Holding[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return all.filter((h: Holding) => h.userId === getUserId())
  } catch { return [] }
}

function saveLocalHoldings(holdings: Holding[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const others = all.filter((h: Holding) => h.userId !== getUserId())
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...others, ...holdings]))
  } catch {}
}

// ==================== API 调用 ====================
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const email = getUserEmail()
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${email}`,
      ...(options.headers || {})
    }
  })
}

async function loadFromApi(): Promise<Holding[] | null> {
  try {
    const resp = await apiFetch('/holdings')
    if (resp.ok) {
      const json = await resp.json()
      if (json.ok && Array.isArray(json.data)) {
        saveLocalHoldings(json.data)
        return json.data
      }
    }
  } catch (e) {
    console.warn('API 获取持仓失败，降级到本地:', e)
  }
  return null
}

// ==================== Store ====================
interface HoldingState {
  holdings: Holding[]
  loading: boolean
  refreshing: boolean
  syncedAt: string | null

  loadHoldings: () => Promise<void>
  addHolding: (data: HoldingFormData) => Promise<void>
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

  loadHoldings: async () => {
    set({ loading: true })
    const apiHoldings = await loadFromApi()
    if (apiHoldings !== null) {
      set({ holdings: apiHoldings, loading: false, syncedAt: new Date().toISOString() })
      return
    }
    const local = loadLocalHoldings()
    set({ holdings: local, loading: false })
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

    const holdings = [...get().holdings, newHolding]
    saveLocalHoldings(holdings)
    set({ holdings })

    try {
      const resp = await apiFetch('/holdings', { method: 'POST', body: JSON.stringify(newHolding) })
      if (resp.ok && (await resp.json()).ok) {
        set({ syncedAt: new Date().toISOString() })
      }
    } catch (e) {
      console.warn('同步新增持仓失败:', e)
    }
  },

  updateHolding: async (id: string, data: Partial<HoldingFormData>) => {
    const holdings = get().holdings.map(h =>
      h.id === id ? { ...h, ...data, lastUpdated: new Date().toISOString() } : h
    )
    saveLocalHoldings(holdings)
    set({ holdings })

    const updated = holdings.find(h => h.id === id)
    if (updated) {
      try {
        const resp = await apiFetch(`/holdings/${id}`, { method: 'PUT', body: JSON.stringify(updated) })
        if (resp.ok && (await resp.json()).ok) {
          set({ syncedAt: new Date().toISOString() })
        }
      } catch (e) {
        console.warn('同步更新持仓失败:', e)
      }
    }
  },

  deleteHolding: async (id: string) => {
    const holdings = get().holdings.filter(h => h.id !== id)
    saveLocalHoldings(holdings)
    set({ holdings })

    try {
      const resp = await apiFetch(`/holdings/${id}`, { method: 'DELETE' })
      if (resp.ok) set({ syncedAt: new Date().toISOString() })
    } catch (e) {
      console.warn('同步删除持仓失败:', e)
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
        if (newPrice && newPrice > 0 && isValidPrice(newPrice)) {
          if (h.currentPrice > 0) {
            const ratio = newPrice / h.currentPrice
            if (ratio < 0.1 || ratio > 10) {
              console.warn(`股票 ${h.symbol} 价格异常，已跳过`)
              return h
            }
          }
          return {
            ...h,
            currentPrice: newPrice,
            name: found?.name || h.name,
            lastUpdated: new Date().toISOString()
          }
        }
        return h
      })

      saveLocalHoldings(updated)
      set({ holdings: updated })

      try {
        const resp = await apiFetch('/holdings', { method: 'PUT', body: JSON.stringify({ holdings: updated }) })
        if (resp.ok) set({ syncedAt: new Date().toISOString() })
      } catch (e) {
        console.warn('同步价格到 API 失败:', e)
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
