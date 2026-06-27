import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.DB

    // 检查 users 表是否存在
    const tableCheck = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).first()

    if (tableCheck) {
      return jsonResponse({
        ok: true,
        data: { initialized: true, message: '数据库已初始化' }
      })
    }

    // 创建 users 表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `)

    return jsonResponse({
      ok: true,
      data: { initialized: true, message: '数据库初始化成功' }
    })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || '初始化失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
