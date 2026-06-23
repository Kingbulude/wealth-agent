import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Holding, HoldingFormData } from '../types/holding'
import { useAuthStore } from '../renderer/stores/authStore'
import { fetchBatchPrices, isValidPrice } from '../services/stockService'

const STORAGE_KEY = 'wealth_agent_holdings'

function getCurrentUserId(): string {
  const user = useAuthStore.getState().user
  return user?.id || ''
}

function loadHoldingsFromStorage(): Holding[] {
  const allHoldings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  const userId = getCurrentUserId()
  return allHoldings.filter((h: Holding) => h.userId === userId)
}

function saveHoldingsToStorage(holdings: Holding[]): void {
  const allHoldings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  const userId = getCurrentUserId()
  const otherHoldings = allHoldings.filter((h: Holding) => h.userId !== userId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...otherHoldings, ...holdings]))
}

interface HoldingState {
  holdings: Holding[]
  loading: boolean
  refreshing: boolean
  loadHoldings: () => void
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

export const useHoldingStore = create<HoldingState>()(
  persist(
    (set, get) => ({
      holdings: [],
      loading: false,
      refreshing: false,

      loadHoldings: () => {
        set({ loading: true })
        const holdings = loadHoldingsFromStorage()
        set({ holdings, loading: false })
      },

      addHolding: async (data: HoldingFormData) => {
        const newHolding: Holding = {
          id: crypto.randomUUID(),
          userId: getCurrentUserId(),
          type: data.type,
          symbol: data.symbol,
          name: data.name,
          quantity: data.quantity,
          avgCost: data.avgCost,
          currentPrice: data.avgCost,
          lastUpdated: new Date().toISOString()
        }

        const holdings = [...get().holdings, newHolding]
        saveHoldingsToStorage(holdings)
        set({ holdings })
      },

      updateHolding: async (id: string, data: Partial<HoldingFormData>) => {
        const holdings = get().holdings.map(h =>
          h.id === id
            ? { ...h, ...data, lastUpdated: new Date().toISOString() }
            : h
        )
        saveHoldingsToStorage(holdings)
        set({ holdings })
      },

      deleteHolding: async (id: string) => {
        const holdings = get().holdings.filter(h => h.id !== id)
        saveHoldingsToStorage(holdings)
        set({ holdings })
      },

      getHoldingsByType: (type: 'stock' | 'fund' | 'all') => {
        if (type === 'all') return get().holdings
        return get().holdings.filter(h => h.type === type)
      },

      getTotalValue: (type?: 'stock' | 'fund') => {
        const holdings = type ? get().getHoldingsByType(type) : get().holdings
        return holdings.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0)
      },

      getTotalCost: (type?: 'stock' | 'fund') => {
        const holdings = type ? get().getHoldingsByType(type) : get().holdings
        return holdings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0)
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

          const updatedHoldings = holdings.map(h => {
            const found = result.prices.get(h.symbol)
            const newPrice = found?.price
            if (newPrice && newPrice > 0 && isValidPrice(newPrice)) {
              if (h.currentPrice > 0) {
                const ratio = newPrice / h.currentPrice
                if (ratio < 0.1 || ratio > 10) {
                  console.warn(`股票 ${h.symbol} 价格异常: 原 ¥${h.currentPrice} → 新 ¥${newPrice}，已跳过`)
                  return h
                }
              }
              return {
                ...h,
                currentPrice: newPrice,
                // 如果 API 返回了名称，覆盖本地（防止用户输入时填错）
                name: found?.name || h.name,
                lastUpdated: new Date().toISOString()
              }
            }
            return h
          })

          saveHoldingsToStorage(updatedHoldings)
          set({ holdings: updatedHoldings })

          return { successCount: result.successCount, totalCount: result.totalCount }
        } catch (error) {
          console.error('刷新价格失败:', error)
          return { successCount: 0, totalCount: get().holdings.length }
        } finally {
          set({ refreshing: false })
        }
      },

      /**
       * 单次拉取：用于添加持仓后立刻显示当前价
       */
      fetchPriceFor: async (type: 'stock' | 'fund', symbol: string) => {
        const r = await fetchBatchPrices([{ type, symbol }])
        return r.prices.get(symbol) || null
      }
    }),
    {
      name: 'wealth-agent-holdings'
    }
  )
)
