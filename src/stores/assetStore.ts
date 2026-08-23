import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Asset, AssetFormData, AssetCategory, AssetSubType } from '../types/asset'
import { useAuthStore } from '../renderer/stores/authStore'
import { getApiUrl } from '../utils/apiUrl'
import { SyncStatus } from './holdingStore'

const ASSETS_KEY = 'wealth-agent-assets'

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

interface CustomType {
  type: AssetSubType
  name: string
  category: AssetCategory
}

interface AssetState {
  assets: Asset[]
  customTypes: CustomType[]
  loading: boolean
  syncedAt: string | null
  syncStatus: SyncStatus
  lastSyncError: string | null

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

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      assets: [],
      customTypes: [],
      loading: false,
      syncedAt: null,
      syncStatus: 'local',
      lastSyncError: null,

      loadAssets: async () => {
        set({ loading: true })

        let apiFailed = false
        let apiFailMsg = ''

        let assets: Asset[] = []
        try {
          const resp = await apiFetch('/assets')
          if (resp.ok) {
            const json = await resp.json()
            if (json.ok && Array.isArray(json.data)) {
              assets = json.data
            } else {
              apiFailed = true
              apiFailMsg = `HTTP ${resp.status} 响应格式错误`
            }
          } else {
            apiFailed = true
            apiFailMsg = `HTTP ${resp.status}`
          }
        } catch (e: any) {
          apiFailed = true
          apiFailMsg = e.message || '网络异常'
          console.warn('[assets] 加载云端失败:', e)
        }

        let customTypes: CustomType[] = []
        try {
          const resp = await apiFetch('/preferences/custom_types')
          if (resp.ok) {
            const json = await resp.json()
            if (json.ok && json.data?.value) {
              customTypes = json.data.value
            }
          }
        } catch (e) {
          console.warn('[assets] 获取自定义类型失败:', e)
        }

        if (apiFailed) {
          // API 失败：不覆盖掉 persist 里已有的 assets/customTypes，保留缓存
          const cachedAssets = get().assets
          const cachedCustomTypes = get().customTypes
          const hasCache = cachedAssets.length > 0 || cachedCustomTypes.length > 0
          const fallbackAssets = assets.length > 0 ? assets : cachedAssets
          const fallbackCustom = customTypes.length > 0 ? customTypes : cachedCustomTypes
          set({
            assets: fallbackAssets,
            customTypes: fallbackCustom,
            loading: false,
            syncedAt: get().syncedAt,
            syncStatus: hasCache ? 'local' : 'error',
            lastSyncError: `加载云端资产失败（${apiFailMsg}）${hasCache ? '，当前显示本地缓存数据' : ''}`
          })
          return
        }

        set({
          assets,
          customTypes,
          loading: false,
          syncedAt: new Date().toISOString(),
          syncStatus: 'synced',
          lastSyncError: null
        })
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

    const resp = await apiFetch('/assets', { method: 'POST', body: JSON.stringify(newAsset) })
    if (resp.ok) {
      set(state => ({
        assets: [...state.assets, newAsset],
        syncedAt: new Date().toISOString(),
        syncStatus: 'synced',
        lastSyncError: null
      }))
    } else {
      set({ syncStatus: 'error', lastSyncError: '添加资产同步失败' })
      throw new Error('添加资产失败')
    }
  },

  updateAsset: async (id: string, data: Partial<AssetFormData>) => {
    const assets = get().assets.map(a => {
      if (a.id === id) {
        const { isSample: _isSample, ...rest } = a
        return { ...rest, ...data, updatedAt: new Date().toISOString() }
      }
      return a
    })

    const updated = assets.find(a => a.id === id)
    if (updated) {
      const resp = await apiFetch(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(updated) })
      if (resp.ok) {
        set({
          assets,
          syncedAt: new Date().toISOString(),
          syncStatus: 'synced',
          lastSyncError: null
        })
      } else {
        set({ syncStatus: 'error', lastSyncError: '更新资产同步失败' })
        throw new Error('更新资产失败')
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

    const resp = await apiFetch('/assets', { method: 'POST', body: JSON.stringify(newAsset) })
    if (resp.ok) {
      set(state => ({
        assets: [...state.assets, newAsset],
        syncedAt: new Date().toISOString(),
        syncStatus: 'synced',
        lastSyncError: null
      }))
    } else {
      set({ syncStatus: 'error', lastSyncError: '添加示例资产同步失败' })
    }
  },

  deleteAsset: async (id: string) => {
    const resp = await apiFetch(`/assets/${id}`, { method: 'DELETE' })
    if (resp.ok) {
      set(state => ({
        assets: state.assets.filter(a => a.id !== id),
        syncedAt: new Date().toISOString(),
        syncStatus: 'synced',
        lastSyncError: null
      }))
    } else {
      set({ syncStatus: 'error', lastSyncError: '删除资产同步失败' })
      throw new Error('删除资产失败')
    }
  },

  addCustomType: (type: AssetSubType, name: string, category: AssetCategory) => {
    set(state => {
      const customTypes = [...state.customTypes, { type, name, category }]
      apiFetch('/preferences/custom_types', {
        method: 'PUT',
        body: JSON.stringify({ value: customTypes })
      }).catch(e => console.warn('同步自定义类型失败:', e))
      return { customTypes }
    })
  },

  deleteCustomType: (type: AssetSubType) => {
    set(state => {
      const customTypes = state.customTypes.filter(ct => ct.type !== type)
      apiFetch('/preferences/custom_types', {
        method: 'PUT',
        body: JSON.stringify({ value: customTypes })
      }).catch(e => console.warn('同步自定义类型失败:', e))
      return { customTypes }
    })
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
}),
    {
      name: ASSETS_KEY,
      partialize: (state) => ({
        assets: state.assets,
        customTypes: state.customTypes,
        syncedAt: state.syncedAt,
      })
    }
  )
)