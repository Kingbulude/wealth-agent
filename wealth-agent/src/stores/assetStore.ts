import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset, AssetFormData } from '../types/asset'
import { useAuthStore } from '../renderer/stores/authStore'

const STORAGE_KEY = 'wealth_agent_assets'

interface AssetState {
  assets: Asset[]
  loading: boolean
  loadAssets: () => void
  addAsset: (data: AssetFormData) => Promise<void>
  updateAsset: (id: string, data: Partial<AssetFormData>) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  getAssetsByType: (type: string) => Asset[]
  getTotalAssets: () => number
  getTotalLiabilities: () => number
  getNetWorth: () => number
}

// 获取当前用户ID
function getCurrentUserId(): string {
  const user = useAuthStore.getState().user
  return user?.id || ''
}

// 从localStorage加载资产
function loadAssetsFromStorage(): Asset[] {
  const allAssets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  const userId = getCurrentUserId()
  return allAssets.filter((asset: Asset) => asset.userId === userId)
}

// 保存资产到localStorage
function saveAssetsToStorage(assets: Asset[]): void {
  const allAssets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  const userId = getCurrentUserId()
  
  // 移除当前用户的旧资产
  const otherAssets = allAssets.filter((a: Asset) => a.userId !== userId)
  
  // 添加新资产
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...otherAssets, ...assets]))
}

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      assets: [],
      loading: false,

      loadAssets: () => {
        set({ loading: true })
        const assets = loadAssetsFromStorage()
        set({ assets, loading: false })
      },

      addAsset: async (data: AssetFormData) => {
        const newAsset: Asset = {
          id: crypto.randomUUID(),
          userId: getCurrentUserId(),
          type: data.type,
          name: data.name,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        const assets = [...get().assets, newAsset]
        saveAssetsToStorage(assets)
        set({ assets })
      },

      updateAsset: async (id: string, data: Partial<AssetFormData>) => {
        const assets = get().assets.map(asset =>
          asset.id === id
            ? { ...asset, ...data, updatedAt: new Date().toISOString() }
            : asset
        )
        saveAssetsToStorage(assets)
        set({ assets })
      },

      deleteAsset: async (id: string) => {
        const assets = get().assets.filter(asset => asset.id !== id)
        saveAssetsToStorage(assets)
        set({ assets })
      },

      getAssetsByType: (type: string) => {
        if (!type || type === 'all') return get().assets
        return get().assets.filter(asset => asset.type === type)
      },

      getTotalAssets: () => {
        return get().assets
          .filter(asset => asset.type !== 'debt')
          .reduce((sum, asset) => sum + asset.amount, 0)
      },

      getTotalLiabilities: () => {
        return get().assets
          .filter(asset => asset.type === 'debt')
          .reduce((sum, asset) => sum + asset.amount, 0)
      },

      getNetWorth: () => {
        return get().getTotalAssets() - get().getTotalLiabilities()
      }
    }),
    {
      name: 'wealth-agent-assets'
    }
  )
)