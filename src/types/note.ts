// 投资笔记模块类型定义
// 三端共享：D1 + localStorage + API

export type NoteCategory = 'cognition' | 'trade' | 'review' | 'learning'

export interface Note {
  id: string
  user_email: string
  category: NoteCategory
  title: string
  content_json: string         // 块编辑器/Markdown JSON 字符串
  content_text: string         // 纯文本（用于搜索）
  tags: string                 // 逗号分隔
  is_pinned: number | boolean  // 0/1 或 false/true
  is_archived: number | boolean
  related_holding_id?: string | null
  created_at: string
  updated_at: string
}

export interface NoteInput {
  id?: string
  category?: NoteCategory
  title: string
  content_json: string
  content_text: string
  tags?: string
  is_pinned?: boolean
  is_archived?: boolean
  related_holding_id?: string | null
}

// 持仓交易决策记录
export interface PositionTradeRecord {
  id: string
  user_email: string
  holding_id: string
  action: 'buy' | 'sell'
  price: number
  quantity: number
  reason: string
  target_price: number | null
  stop_loss_price: number | null
  holding_period: 'short' | 'mid' | 'long' | null
  market_context: string | null
  record_time: string
  created_at: string
}

export interface PositionTradeRecordInput {
  id?: string
  holding_id: string
  action: 'buy' | 'sell'
  price: number
  quantity: number
  reason: string
  target_price?: number | null
  stop_loss_price?: number | null
  holding_period?: 'short' | 'mid' | 'long' | null
  market_context?: string | null
  record_time?: string
}

// 持仓复盘笔记
export interface PositionReviewNote {
  id: string
  user_email: string
  holding_id: string
  content_json: string
  content_text: string
  price_snapshot: number | null
  profit_pct_snapshot: number | null
  created_at: string
}

export interface PositionReviewNoteInput {
  id?: string
  holding_id: string
  content_json: string
  content_text: string
  price_snapshot?: number | null
  profit_pct_snapshot?: number | null
}

// 学习资料收藏
export type LearningResourceType = 'report' | 'book' | 'article' | 'video' | 'other'

export interface LearningResource {
  id: string
  user_email: string
  title: string
  url: string
  type: LearningResourceType
  tags: string
  notes: string
  created_at: string
}

export interface LearningResourceInput {
  id?: string
  title: string
  url: string
  type: LearningResourceType
  tags?: string
  notes?: string
}
