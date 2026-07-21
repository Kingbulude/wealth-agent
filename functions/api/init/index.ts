import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.DB

    await db.exec(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, user_email TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'cognition', title TEXT, content_json TEXT NOT NULL, content_text TEXT, tags TEXT, is_pinned INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0, related_holding_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_email);`)

    await db.exec(`CREATE TABLE IF NOT EXISTS learning_resources (id TEXT PRIMARY KEY, user_email TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, type TEXT NOT NULL, tags TEXT, notes TEXT, created_at TEXT NOT NULL);`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_learning_user ON learning_resources(user_email);`)

    await db.exec(`CREATE TABLE IF NOT EXISTS position_trade_records (id TEXT PRIMARY KEY, user_email TEXT NOT NULL, holding_id TEXT NOT NULL, action TEXT NOT NULL, price REAL NOT NULL, quantity REAL NOT NULL, reason TEXT NOT NULL, target_price REAL, stop_loss_price REAL, holding_period TEXT, market_context TEXT, record_time TEXT NOT NULL, created_at TEXT NOT NULL);`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_trade_user ON position_trade_records(user_email);`)

    await db.exec(`CREATE TABLE IF NOT EXISTS position_review_notes (id TEXT PRIMARY KEY, user_email TEXT NOT NULL, holding_id TEXT NOT NULL, content_json TEXT NOT NULL, content_text TEXT, price_snapshot REAL, profit_pct_snapshot REAL, created_at TEXT NOT NULL);`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_review_user ON position_review_notes(user_email);`)

    await db.exec(`CREATE TABLE IF NOT EXISTS holdings (id TEXT PRIMARY KEY, user_email TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_email);`)

    await db.exec(`CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, user_email TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_email);`)

    return jsonResponse({
      ok: true,
      data: { initialized: true, message: '数据库表创建成功' }
    })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || '初始化失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()