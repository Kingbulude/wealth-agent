import { create } from 'zustand'
import { useAuthStore } from '../renderer/stores/authStore'
import {
  listLearningResources,
  createLearningResource,
  updateLearningResource,
  deleteLearningResource
} from '../services/learningService'
import type { LearningResource, LearningResourceInput, LearningResourceType } from '../types/note'

function getUserId(): string {
  const user = useAuthStore.getState().user
  return user?.email || user?.id || ''
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
      set({ resources: data, lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[learning] 加载云端失败:', e)
      set({ resources: [] })
    } finally {
      set({ loading: false })
    }
  },

  create: async (input: LearningResourceInput) => {
    const userEmail = getUserId()
    const remote = await createLearningResource(input)
    const resource: LearningResource = {
      ...remote,
      user_email: userEmail
    }
    set(state => ({
      resources: [resource, ...state.resources],
      lastSyncAt: new Date().toISOString()
    }))
    return resource
  },

  update: async (id: string, patch: Partial<LearningResourceInput>) => {
    await updateLearningResource(id, patch)
    set(state => ({
      resources: state.resources.map(r => r.id === id ? { ...r, ...patch } : r),
      lastSyncAt: new Date().toISOString()
    }))
  },

  remove: async (id: string) => {
    await deleteLearningResource(id)
    set(state => ({
      resources: state.resources.filter(r => r.id !== id),
      lastSyncAt: new Date().toISOString()
    }))
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