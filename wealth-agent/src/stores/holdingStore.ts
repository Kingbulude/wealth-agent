import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Holding, HoldingFormData } from '../types/holding'
import { useAuthStore } from '../renderer/stores/authStore'

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
  loadHoldings: () => void
  addHolding: (data: HoldingFormData) => Promise<void>
  updateHolding: (id: string, data: Partial<HoldingFormData>) => Promise<void>
  deleteHolding: (id: string) => Promise<void>
  getHoldingsByType: (type: 'stock' | 'fund' | 'all') => Holding[]
  getTotalValue: (type?: 'stock' | 'fund') => number
  getTotalProfit: (type?: 'stock' | 'fund') => number
  getTotalCost: (type?: 'stock' | 'fund') => number
  getProfitRate: (type?: 'stock' | 'fund') => number
}

export const useHoldingStore = create<HoldingState>()(
  persist(
    (set, get) => ({
      holdings: [],
      loading: false,

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
          currentPrice: data.avgCost, // 初始等于成本价，后续会更新
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
      }
    }),
    {
      name: 'wealth-agent-holdings'
    }
  )
)
