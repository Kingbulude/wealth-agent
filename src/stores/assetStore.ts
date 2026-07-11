import { create } from 'zustand'
import { Asset, AssetFormData, AssetCategory, AssetSubType } from '../types/asset'
import { useAuthStore } from '../renderer/stores/authStore'
import { getApiUrl } from '../utils/apiUrl'

const ASSETS_KEY = 'wealth_agent_assets'
const CUSTOM_TYPES_KEY = 'wealth_agent_custom_types'

function getUserEmail(): string {
  return useAuthStore.getState().user?.email || ''
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

// ==================== API 工具 ====================
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

// ==================== 本地降级 ====================
function loadLocalAssets(): Asset[] {
  try {
    const all = JSON.parse(localStorage.getItem(ASSETS_KEY) || '[]')
    return all.filter((a: Asset) => a.userId === getUserId())
  } catch { return [] }
}

function saveLocalAssets(assets: Asset[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(ASSETS_KEY) || '[]')
    const others = all.filter((a: Asset) => a.userId !== getUserId())
    localStorage.setItem(ASSETS_KEY, JSON.stringify([...others, ...assets]))
  } catch {}
}

function loadLocalCustomTypes(): CustomType[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_TYPES_KEY) || '[]') }
  catch { return [] }
}

function saveLocalCustomTypes(types: CustomType[]): void {
  try { localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(types)) } catch {}
}

// ==================== Type ====================
export interface CustomType {
  type: AssetSubType
  name: string
  category: AssetCategory
}

interface AssetState {
  assets: Asset[]
  customTypes: CustomType[]
  loading: boolean
  syncedAt: string | null

  loadAssets: () => Promise<void>
  addAsset: (data: AssetFormData) => Promise<void>
  addSampleAsset: (data: AssetFormData) => Promise<void>
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

export const useAssetStore = create<AssetState>()((set, get) => ({
  assets: [],
  customTypes: [],
  loading: false,
  syncedAt: null,

  loadAssets: async () => {
    set({ loading: true })

    // 1) 从 API 拉取资产列表
    let assets: Asset[] | null = null
    try {
      const resp = await apiFetch('/assets')
      if (resp.ok) {
        const json = await resp.json()
        if (json.ok && Array.isArray(json.data)) {
          assets = json.data
          // 只有当 API 返回非空数据时才覆盖本地存储
          if (assets.length > 0) {
            saveLocalAssets(assets)
          }
        }
      }
    } catch (e) {
      console.warn('API 获取资产失败，降级到本地:', e)
    }
    // API 返回空数组时也回退到本地存储
    if (!assets || assets.length === 0) assets = loadLocalAssets()

    // 2) 拉取自定义类型
    let customTypes: CustomType[] = loadLocalCustomTypes()
    try {
      const resp = await apiFetch('/preferences/custom_types')
      if (resp.ok) {
        const json = await resp.json()
        if (json.ok && json.data?.value) {
          customTypes = json.data.value
          saveLocalCustomTypes(customTypes)
        }
      }
    } catch (e) {
      console.warn('API 获取自定义类型失败:', e)
    }

    set({ assets, customTypes, loading: false, syncedAt: new Date().toISOString() })
  },

  addAsset: async (data: AssetFormData) => {
    const newAsset: Asset = {
      id: crypto.randomUUID(),
      userId: getUserId(),
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
    saveLocalAssets(assets)
    set({ assets })

    try {
      const resp = await apiFetch('/assets', { method: 'POST', body: JSON.stringify(newAsset) })
      if (resp.ok) set({ syncedAt: new Date().toISOString() })
    } catch (e) {
      console.warn('同步资产失败:', e)
    }
  },

  updateAsset: async (id: string, data: Partial<AssetFormData>) => {
    const assets = get().assets.map(a => {
      if (a.id === id) {
        // 编辑示例数据时，移除示例标记
        const { isSample, ...rest } = a
        return { ...rest, ...data, updatedAt: new Date().toISOString() }
      }
      return a
    })
    saveLocalAssets(assets)
    set({ assets })

    const updated = assets.find(a => a.id === id)
    if (updated) {
      try {
        const resp = await apiFetch(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(updated) })
        if (resp.ok) set({ syncedAt: new Date().toISOString() })
      } catch (e) {
        console.warn('同步更新资产失败:', e)
      }
    }
  },

  addSampleAsset: async (data: AssetFormData) => {
    const newAsset: Asset = {
      id: crypto.randomUUID(),
      userId: getUserId(),
      category: data.category,
      type: data.type,
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      isSample: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const assets = [...get().assets, newAsset]
    saveLocalAssets(assets)
    set({ assets })

    try {
      const resp = await apiFetch('/assets', { method: 'POST', body: JSON.stringify(newAsset) })
      if (resp.ok) set({ syncedAt: new Date().toISOString() })
    } catch (e) {
      console.warn('同步示例资产失败:', e)
    }
  },

  deleteAsset: async (id: string) => {
    const assets = get().assets.filter(a => a.id !== id)
    saveLocalAssets(assets)
    set({ assets })

    try {
      const resp = await apiFetch(`/assets/${id}`, { method: 'DELETE' })
      if (resp.ok) set({ syncedAt: new Date().toISOString() })
    } catch (e) {
      console.warn('同步删除资产失败:', e)
    }
  },

  addCustomType: (type: AssetSubType, name: string, category: AssetCategory) => {
    const customTypes = [...get().customTypes, { type, name, category }]
    saveLocalCustomTypes(customTypes)
    set({ customTypes })

    // 同步到 D1
    apiFetch('/preferences/custom_types', {
      method: 'PUT',
      body: JSON.stringify({ value: customTypes })
    }).catch(e => console.warn('同步自定义类型失败:', e))
  },

  deleteCustomType: (type: AssetSubType) => {
    const customTypes = get().customTypes.filter(ct => ct.type !== type)
    saveLocalCustomTypes(customTypes)
    set({ customTypes })

    apiFetch('/preferences/custom_types', {
      method: 'PUT',
      body: JSON.stringify({ value: customTypes })
    }).catch(e => console.warn('同步自定义类型失败:', e))
  },

  getAssetsByType: (type: string) => {
    if (!type || type === 'all') return get().assets
    return get().assets.filter(a => a.type === type)
  },

  getAssetsByCategory: (category: string) => {
    if (!category || category === 'all') return get().assets
    return get().assets.filter(a => a.category === category)
  },

  getTotalAssets: () => {
    return get().assets
      .filter(a => a.category !== 'debt')
      .reduce((sum, a) => sum + a.amount, 0)
  },

  getTotalLiabilities: () => {
    return get().assets
      .filter(a => a.category === 'debt')
      .reduce((sum, a) => sum + a.amount, 0)
  },

  getNetWorth: () => {
    return get().getTotalAssets() - get().getTotalLiabilities()
  }
}))
