import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset, AssetFormData, AssetCategory, AssetSubType } from '../types/asset'
import { useAuthStore } from '../renderer/stores/authStore'

const STORAGE_KEY = 'wealth_agent_assets'
const CUSTOM_TYPES_KEY = 'wealth_agent_custom_types'

export interface CustomType {
  type: AssetSubType
  name: string
  category: AssetCategory
}

interface AssetState {
  assets: Asset[]
  customTypes: CustomType[]
  loading: boolean
  loadAssets: () => void
  addAsset: (data: AssetFormData) => Promise<void>
  updateAsset: (id: string, data: Partial<AssetFormData>) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  addCustomType: (type: AssetSubType, name: string, category: AssetCategory) => void
  deleteCustomType: (type: AssetSubType) => void
  getAssetsByType: (type: string) => Asset[]
  getAssetsByCategory: (category: string) => Asset[]
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

// 从localStorage加载自定义类型
function loadCustomTypesFromStorage(): CustomType[] {
  const data = localStorage.getItem(CUSTOM_TYPES_KEY)
  return data ? JSON.parse(data) : []
}

// 保存自定义类型到localStorage
function saveCustomTypesToStorage(customTypes: CustomType[]): void {
  localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(customTypes))
}

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      assets: [],
      customTypes: [],
      loading: false,

      loadAssets: () => {
        set({ loading: true })
        const assets = loadAssetsFromStorage()
        const customTypes = loadCustomTypesFromStorage()
        set({ assets, customTypes, loading: false })
      },

      addAsset: async (data: AssetFormData) => {
        const newAsset: Asset = {
          id: crypto.randomUUID(),
          userId: getCurrentUserId(),
          category: data.category,
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

      addCustomType: (type: AssetSubType, name: string, category: AssetCategory) => {
        const customTypes = [...get().customTypes, { type, name, category }]
        saveCustomTypesToStorage(customTypes)
        set({ customTypes })
      },

      deleteCustomType: (type: AssetSubType) => {
        const customTypes = get().customTypes.filter(ct => ct.type !== type)
        saveCustomTypesToStorage(customTypes)
        set({ customTypes })
      },

      getAssetsByType: (type: string) => {
        if (!type || type === 'all') return get().assets
        return get().assets.filter(asset => asset.type === type)
      },

      getAssetsByCategory: (category: string) => {
        if (!category || category === 'all') return get().assets
        return get().assets.filter(asset => asset.category === category)
      },

      getTotalAssets: () => {
        return get().assets
          .filter(asset => asset.category !== 'debt')
          .reduce((sum, asset) => sum + asset.amount, 0)
      },

      getTotalLiabilities: () => {
        return get().assets
          .filter(asset => asset.category === 'debt')
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
