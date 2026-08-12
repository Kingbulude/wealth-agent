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

function getUserId(): string {
  const user = useAuthStore.getState().user
  return user?.email || user?.id || ''
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
      set({ trades: data, lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[position-notes] 加载交易记录失败:', e)
      set({ trades: [] })
    } finally {
      set({ loading: false })
    }
  },

  createTrade: async (input: PositionTradeRecordInput) => {
    const userEmail = getUserId()
    const remote = await createTradeRecord(input)
    const trade: PositionTradeRecord = {
      ...remote,
      user_email: userEmail,
      target_price: remote.target_price ?? null,
      stop_loss_price: remote.stop_loss_price ?? null,
      holding_period: remote.holding_period ?? null,
      market_context: remote.market_context ?? null
    }
    set(state => ({
      trades: [trade, ...state.trades],
      lastSyncAt: new Date().toISOString()
    }))
    return trade
  },

  updateTrade: async (id: string, patch: Partial<PositionTradeRecordInput>) => {
    await updateTradeRecord(id, patch)
    set(state => ({
      trades: state.trades.map(t => t.id === id ? { ...t, ...patch } : t),
      lastSyncAt: new Date().toISOString()
    }))
  },

  deleteTrade: async (id: string) => {
    await deleteTradeRecord(id)
    set(state => ({
      trades: state.trades.filter(t => t.id !== id),
      lastSyncAt: new Date().toISOString()
    }))
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
      set({ reviews: data, lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[position-notes] 加载复盘笔记失败:', e)
      set({ reviews: [] })
    } finally {
      set({ loading: false })
    }
  },

  createReview: async (input: PositionReviewNoteInput) => {
    const userEmail = getUserId()
    const remote = await createReviewNote(input)
    const review: PositionReviewNote = {
      ...remote,
      user_email: userEmail,
      price_snapshot: remote.price_snapshot ?? null,
      profit_pct_snapshot: remote.profit_pct_snapshot ?? null
    }
    set(state => ({
      reviews: [review, ...state.reviews],
      lastSyncAt: new Date().toISOString()
    }))
    return review
  },

  getReviewsByHolding: (holdingId: string) => {
    return get().reviews
      .filter(r => r.holding_id === holdingId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  }
}))