// 净资产目标 Store
// 存储位置：preferences 表，key = "networth_goal"
// 后端 API 复用：/api/preferences/networth_goal（GET/PUT/DELETE）

import { create } from 'zustand'
import { useAuthStore } from '../renderer/stores/authStore'
import { getApiUrl } from '../utils/apiUrl'

export interface NetworthGoal {
  /** 目标金额（元） */
  amount: number
  /** 目标日期（可选，ISO yyyy-mm-dd） */
  targetDate?: string
  /** 备注（可选，如"3年2000万"） */
  note?: string
  /** 是否为示例数据 */
  isSample?: boolean
  /** 创建时间（ISO） */
  createdAt: string
}

interface GoalState {
  goal: NetworthGoal | null
  loading: boolean
  saving: boolean
  error: string | null

  loadGoal: () => Promise<void>
  setGoal: (g: Omit<NetworthGoal, 'createdAt' | 'isSample'>) => Promise<void>
  setSampleGoal: (g: Omit<NetworthGoal, 'createdAt'>) => Promise<void>
  clearGoal: () => Promise<void>
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

export const useGoalStore = create<GoalState>((set, get) => ({
  goal: null,
  loading: false,
  saving: false,
  error: null,

  loadGoal: async () => {
    set({ loading: true, error: null })
    try {
      const resp = await apiFetch('/preferences/networth_goal')
      if (!resp.ok) {
        // 401/403 等不当作致命错误，只是不存在目标
        set({ loading: false, goal: null })
        return
      }
      const json = await resp.json()
      if (json.ok) {
        set({ goal: json.data?.value ?? null, loading: false })
      } else {
        set({ error: json.error || '加载目标失败', loading: false })
      }
    } catch (e: any) {
      // 网络错误等：保持原值
      set({ error: e?.message || '加载目标失败', loading: false })
    }
  },

  setGoal: async (g) => {
    set({ saving: true, error: null })
    try {
      // 保留旧的 createdAt（如果存在），避免更新时丢失
      // 编辑示例目标时，移除 isSample 标记
      const existing = get().goal
      const goal: NetworthGoal = {
        ...g,
        createdAt: existing?.createdAt || new Date().toISOString(),
        isSample: false
      }
      const resp = await apiFetch('/preferences/networth_goal', {
        method: 'PUT',
        body: JSON.stringify({ value: goal })
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${resp.status}`)
      }
      set({ goal, saving: false })
    } catch (e: any) {
      set({ error: e?.message || '保存目标失败', saving: false })
      throw e
    }
  },

  setSampleGoal: async (g) => {
    set({ saving: true, error: null })
    try {
      const existing = get().goal
      const goal: NetworthGoal = {
        ...g,
        createdAt: existing?.createdAt || new Date().toISOString(),
        isSample: true
      }
      const resp = await apiFetch('/preferences/networth_goal', {
        method: 'PUT',
        body: JSON.stringify({ value: goal })
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${resp.status}`)
      }
      set({ goal, saving: false })
    } catch (e: any) {
      set({ error: e?.message || '保存示例目标失败', saving: false })
      throw e
    }
  },

  clearGoal: async () => {
    set({ saving: true, error: null })
    try {
      const resp = await apiFetch('/preferences/networth_goal', { method: 'DELETE' })
      const json = await resp.json()
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${resp.status}`)
      }
      set({ goal: null, saving: false })
    } catch (e: any) {
      set({ error: e?.message || '清除目标失败', saving: false })
      throw e
    }
  }
}))
