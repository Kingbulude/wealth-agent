import { getApiUrl } from '../utils/apiUrl'
import { useAuthStore } from '../renderer/stores/authStore'
import type { LearningResource, LearningResourceInput } from '../types/note'

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token
  const resp = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
      ...(options.headers || {})
    }
  })
  if (resp.status === 401) {
    console.warn('[auth] Token 无效，已清除本地认证状态')
    useAuthStore.getState().logout()
  }
  return resp
}

export async function listLearningResources(type?: string): Promise<LearningResource[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : ''
  const resp = await authedFetch(`/learning-resources${qs}`)
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
  return json.data as LearningResource[]
}

export async function createLearningResource(input: LearningResourceInput): Promise<LearningResource> {
  const resp = await authedFetch('/learning-resources', { method: 'POST', body: JSON.stringify(input) })
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
  return json.data as LearningResource
}

export async function updateLearningResource(id: string, patch: Partial<LearningResourceInput>): Promise<void> {
  const resp = await authedFetch(`/learning-resources/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
}

export async function deleteLearningResource(id: string): Promise<void> {
  const resp = await authedFetch(`/learning-resources/${id}`, { method: 'DELETE' })
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
}
