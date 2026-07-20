import { getApiUrl } from '../utils/apiUrl'
import { useAuthStore } from '../renderer/stores/authStore'
import type { PositionTradeRecord, PositionTradeRecordInput, PositionReviewNote, PositionReviewNoteInput } from '../types/note'

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
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

// ============== 交易记录 ==============

export async function listTradeRecords(holdingId?: string): Promise<PositionTradeRecord[]> {
  const qs = holdingId ? `?holding_id=${encodeURIComponent(holdingId)}` : ''
  const resp = await authedFetch(`/position-notes${qs}`)
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
  return json.data as PositionTradeRecord[]
}

export async function createTradeRecord(input: PositionTradeRecordInput): Promise<PositionTradeRecord> {
  const resp = await authedFetch('/position-notes', { method: 'POST', body: JSON.stringify(input) })
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
  return json.data as PositionTradeRecord
}

export async function updateTradeRecord(id: string, patch: Partial<PositionTradeRecordInput>): Promise<void> {
  const resp = await authedFetch(`/position-notes/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
}

export async function deleteTradeRecord(id: string): Promise<void> {
  const resp = await authedFetch(`/position-notes/${id}`, { method: 'DELETE' })
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
}

// ============== 复盘笔记 ==============

export async function listReviewNotes(holdingId?: string): Promise<PositionReviewNote[]> {
  const qs = holdingId ? `?holding_id=${encodeURIComponent(holdingId)}` : ''
  const resp = await authedFetch(`/position-notes/review${qs}`)
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
  return json.data as PositionReviewNote[]
}

export async function createReviewNote(input: PositionReviewNoteInput): Promise<PositionReviewNote> {
  const resp = await authedFetch('/position-notes/review', { method: 'POST', body: JSON.stringify(input) })
  const json = await resp.json()
  if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`)
  return json.data as PositionReviewNote
}
