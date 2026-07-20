import { create } from 'zustand'
import { useAuthStore } from '../renderer/stores/authStore'
import {
  listLearningResources,
  createLearningResource,
  updateLearningResource,
  deleteLearningResource
} from '../services/learningService'
import type { LearningResource, LearningResourceInput, LearningResourceType } from '../types/note'

const STORAGE_KEY = 'wealth_agent_learning_resources'

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

function loadLocal(): LearningResource[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return all.filter((r: LearningResource) => r.user_email === getUserId())
  } catch { return [] }
}

function saveLocal(records: LearningResource[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const others = all.filter((r: LearningResource) => r.user_email !== getUserId())
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...others, ...records]))
  } catch {}
}

interface LearningState {
  resources: LearningResource[]
  loading: boolean
  lastSyncAt: string | null

  loadResources: (type?: LearningResourceType) => Promise<void>
  create: (input: LearningResourceInput) => Promise<LearningResource>
  update: (id: string, patch: Partial<LearningResourceInput>) => Promise<void>
  remove: (id: string) => Promise<void>
  getByType: (type: LearningResourceType) => LearningResource[]
  search: (query: string) => LearningResource[]
}

export const useLearningStore = create<LearningState>()((set, get) => ({
  resources: [],
  loading: false,
  lastSyncAt: null,

  loadResources: async (type?: LearningResourceType) => {
    set({ loading: true })
    try {
      const data = await listLearningResources(type)
      const local = loadLocal()
      const userId = getUserId()
      const merged: LearningResource[] = [...data]
      for (const r of local) {
        if (r.user_email === userId && !merged.find(m => m.id === r.id)) {
          merged.push(r)
        }
      }
      saveLocal(merged)
      set({ resources: merged, lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[learning] 加载失败，使用本地:', e)
      set({ resources: loadLocal() })
    } finally {
      set({ loading: false })
    }
  },

  create: async (input: LearningResourceInput) => {
    const userEmail = getUserId()
    const now = new Date().toISOString()
    const local: LearningResource = {
      id: input.id || crypto.randomUUID(),
      user_email: userEmail,
      title: input.title,
      url: input.url,
      type: input.type,
      tags: input.tags || '',
      notes: input.notes || '',
      created_at: now
    }
    const resources = [local, ...get().resources]
    saveLocal(resources)
    set({ resources })

    try {
      const remote = await createLearningResource(input)
      const updated = resources.map(r => r.id === local.id ? { ...r, ...remote } : r)
      saveLocal(updated)
      set({ resources: updated, lastSyncAt: new Date().toISOString() })
      return remote
    } catch (e) {
      console.warn('[learning] 创建云端失败:', e)
      return local
    }
  },

  update: async (id: string, patch: Partial<LearningResourceInput>) => {
    const resources = get().resources.map(r => r.id === id ? { ...r, ...patch } : r)
    saveLocal(resources)
    set({ resources })
    try {
      await updateLearningResource(id, patch)
      set({ lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[learning] 更新云端失败:', e)
    }
  },

  remove: async (id: string) => {
    const resources = get().resources.filter(r => r.id !== id)
    saveLocal(resources)
    set({ resources })
    try {
      await deleteLearningResource(id)
      set({ lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[learning] 删除云端失败:', e)
    }
  },

  getByType: (type: LearningResourceType) => {
    return get().resources.filter(r => r.type === type)
  },

  search: (query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return get().resources
    return get().resources.filter(r =>
      (r.title || '').toLowerCase().includes(q) ||
      (r.tags || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    )
  }
}))
