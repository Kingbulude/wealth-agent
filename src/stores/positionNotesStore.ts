import { create } from 'zustand'
import { useAuthStore } from '../renderer/stores/authStore'
import {
  listTradeRecords,
  createTradeRecord,
  updateTradeRecord,
  deleteTradeRecord,
  listReviewNotes,
  createReviewNote
} from '../services/positionNotesService'
import type {
  PositionTradeRecord,
  PositionTradeRecordInput,
  PositionReviewNote,
  PositionReviewNoteInput
} from '../types/note'

const TRADE_KEY = 'wealth_agent_trade_records'
const REVIEW_KEY = 'wealth_agent_review_notes'

function getUserId(): string {
  const user = useAuthStore.getState().user
  return user?.email || user?.id || ''
}

function loadLocalTrades(): PositionTradeRecord[] {
  try {
    const all = JSON.parse(localStorage.getItem(TRADE_KEY) || '[]')
    return all.filter((r: PositionTradeRecord) => r.user_email === getUserId())
  } catch { return [] }
}

function saveLocalTrades(records: PositionTradeRecord[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(TRADE_KEY) || '[]')
    const others = all.filter((r: PositionTradeRecord) => r.user_email !== getUserId())
    localStorage.setItem(TRADE_KEY, JSON.stringify([...others, ...records]))
  } catch {}
}

function loadLocalReviews(): PositionReviewNote[] {
  try {
    const all = JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]')
    return all.filter((r: PositionReviewNote) => r.user_email === getUserId())
  } catch { return [] }
}

function saveLocalReviews(records: PositionReviewNote[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]')
    const others = all.filter((r: PositionReviewNote) => r.user_email !== getUserId())
    localStorage.setItem(REVIEW_KEY, JSON.stringify([...others, ...records]))
  } catch {}
}

interface PositionNotesState {
  trades: PositionTradeRecord[]
  reviews: PositionReviewNote[]
  loading: boolean
  lastSyncAt: string | null

  loadTrades: (holdingId?: string) => Promise<void>
  createTrade: (input: PositionTradeRecordInput) => Promise<PositionTradeRecord>
  updateTrade: (id: string, patch: Partial<PositionTradeRecordInput>) => Promise<void>
  deleteTrade: (id: string) => Promise<void>
  getTradesByHolding: (holdingId: string) => PositionTradeRecord[]

  loadReviews: (holdingId?: string) => Promise<void>
  createReview: (input: PositionReviewNoteInput) => Promise<PositionReviewNote>
  getReviewsByHolding: (holdingId: string) => PositionReviewNote[]
}

export const usePositionNotesStore = create<PositionNotesState>()((set, get) => ({
  trades: [],
  reviews: [],
  loading: false,
  lastSyncAt: null,

  loadTrades: async (holdingId?: string) => {
    set({ loading: true })
    try {
      const data = await listTradeRecords(holdingId)
      const local = loadLocalTrades()
      const userId = getUserId()
      const merged: PositionTradeRecord[] = [...data]
      for (const r of local) {
        if (r.user_email === userId && !merged.find(m => m.id === r.id)) {
          merged.push(r)
        }
      }
      saveLocalTrades(merged)
      set({ trades: merged, lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[position-notes] 加载交易记录失败，使用本地:', e)
      set({ trades: loadLocalTrades() })
    } finally {
      set({ loading: false })
    }
  },

  createTrade: async (input: PositionTradeRecordInput) => {
    const userEmail = getUserId()
    const now = new Date().toISOString()
    const local: PositionTradeRecord = {
      id: input.id || crypto.randomUUID(),
      user_email: userEmail,
      holding_id: input.holding_id,
      action: input.action,
      price: input.price,
      quantity: input.quantity,
      reason: input.reason,
      target_price: input.target_price ?? null,
      stop_loss_price: input.stop_loss_price ?? null,
      holding_period: input.holding_period ?? null,
      market_context: input.market_context ?? null,
      record_time: input.record_time || now,
      created_at: now
    }
    const trades = [local, ...get().trades]
    saveLocalTrades(trades)
    set({ trades })

    try {
      const remote = await createTradeRecord(input)
      const updated = trades.map(t => t.id === local.id ? { ...t, ...remote } : t)
      saveLocalTrades(updated)
      set({ trades: updated, lastSyncAt: new Date().toISOString() })
      return remote
    } catch (e) {
      console.warn('[position-notes] 创建交易记录失败:', e)
      return local
    }
  },

  updateTrade: async (id: string, patch: Partial<PositionTradeRecordInput>) => {
    const trades = get().trades.map(t => t.id === id ? { ...t, ...patch } : t)
    saveLocalTrades(trades)
    set({ trades })
    try {
      await updateTradeRecord(id, patch)
      set({ lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[position-notes] 更新交易记录失败:', e)
    }
  },

  deleteTrade: async (id: string) => {
    const trades = get().trades.filter(t => t.id !== id)
    saveLocalTrades(trades)
    set({ trades })
    try {
      await deleteTradeRecord(id)
      set({ lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[position-notes] 删除交易记录失败:', e)
    }
  },

  getTradesByHolding: (holdingId: string) => {
    return get().trades
      .filter(t => t.holding_id === holdingId)
      .sort((a, b) => (b.record_time || '').localeCompare(a.record_time || ''))
  },

  loadReviews: async (holdingId?: string) => {
    set({ loading: true })
    try {
      const data = await listReviewNotes(holdingId)
      const local = loadLocalReviews()
      const userId = getUserId()
      const merged: PositionReviewNote[] = [...data]
      for (const r of local) {
        if (r.user_email === userId && !merged.find(m => m.id === r.id)) {
          merged.push(r)
        }
      }
      saveLocalReviews(merged)
      set({ reviews: merged, lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[position-notes] 加载复盘笔记失败:', e)
      set({ reviews: loadLocalReviews() })
    } finally {
      set({ loading: false })
    }
  },

  createReview: async (input: PositionReviewNoteInput) => {
    const userEmail = getUserId()
    const now = new Date().toISOString()
    const local: PositionReviewNote = {
      id: input.id || crypto.randomUUID(),
      user_email: userEmail,
      holding_id: input.holding_id,
      content_json: input.content_json,
      content_text: input.content_text,
      price_snapshot: input.price_snapshot ?? null,
      profit_pct_snapshot: input.profit_pct_snapshot ?? null,
      created_at: now
    }
    const reviews = [local, ...get().reviews]
    saveLocalReviews(reviews)
    set({ reviews })

    try {
      const remote = await createReviewNote(input)
      const updated = reviews.map(r => r.id === local.id ? { ...r, ...remote } : r)
      saveLocalReviews(updated)
      set({ reviews: updated, lastSyncAt: new Date().toISOString() })
      return remote
    } catch (e) {
      console.warn('[position-notes] 创建复盘笔记失败:', e)
      return local
    }
  },

  getReviewsByHolding: (holdingId: string) => {
    return get().reviews
      .filter(r => r.holding_id === holdingId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  }
}))
