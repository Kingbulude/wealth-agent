import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.DB

    const tableCheck = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).first()

    if (tableCheck) {
      await ensureTables(db)
      return jsonResponse({
        ok: true,
        data: { initialized: true, message: '数据库已初始化' }
      })
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `)

    await ensureTables(db)

    return jsonResponse({
      ok: true,
      data: { initialized: true, message: '数据库初始化成功' }
    })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || '初始化失败' }, 500)
  }
}

async function ensureTables(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'cognition',
      title TEXT,
      content_json TEXT NOT NULL,
      content_text TEXT,
      tags TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      related_holding_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run()

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_email, category, updated_at)').run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS position_trade_records (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      holding_id TEXT NOT NULL,
      action TEXT NOT NULL,
      price REAL NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT NOT NULL,
      target_price REAL,
      stop_loss_price REAL,
      holding_period TEXT,
      market_context TEXT,
      record_time TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run()

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_ptr_user_holding ON position_trade_records(user_email, holding_id, record_time DESC)').run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS position_review_notes (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      holding_id TEXT NOT NULL,
      content_json TEXT NOT NULL,
      content_text TEXT,
      price_snapshot REAL,
      profit_pct_snapshot REAL,
      created_at TEXT NOT NULL
    )
  `).run()

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_prn_user_holding ON position_review_notes(user_email, holding_id, created_at DESC)').run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS learning_resources (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL,
      tags TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    )
  `).run()

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_lr_user ON learning_resources(user_email, type)').run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS holdings (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run()

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_email)').run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run()

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_email)').run()
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()