import { getApiUrl } from '../utils/apiUrl'
import { useAuthStore } from '../renderer/stores/authStore'
import type { Note, NoteInput } from '../types/note'

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

export interface NoteListParams {
  category?: string
  q?: string
  include_archived?: boolean
}

export async function listNotes(params: NoteListParams = {}): Promise<Note[]> {
  const search = new URLSearchParams()
  if (params.category) search.set('category', params.category)
  if (params.q) search.set('q', params.q)
  if (params.include_archived) search.set('include_archived', '1')
  const qs = search.toString()
  const resp = await authedFetch(`/notes${qs ? '?' + qs : ''}`)
  const json = await resp.json()
  if (!resp.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${resp.status}`)
  }
  return json.data as Note[]
}

export async function createNote(input: NoteInput): Promise<Note> {
  const resp = await authedFetch('/notes', { method: 'POST', body: JSON.stringify(input) })
  const json = await resp.json()
  if (!resp.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${resp.status}`)
  }
  return json.data as Note
}

export async function updateNote(id: string, patch: Partial<NoteInput>): Promise<void> {
  const resp = await authedFetch(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
  const json = await resp.json()
  if (!resp.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${resp.status}`)
  }
}

export async function deleteNote(id: string): Promise<void> {
  const resp = await authedFetch(`/notes/${id}`, { method: 'DELETE' })
  const json = await resp.json()
  if (!resp.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${resp.status}`)
  }
}
