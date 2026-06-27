import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.DB
    let dbOk = false
    let userCount = 0

    try {
      const result = await db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>()
      dbOk = true
      userCount = result?.count ?? 0
    } catch {
      dbOk = false
    }

    return jsonResponse({
      ok: true,
      data: {
        status: 'ok',
        db: dbOk ? 'connected' : 'disconnected',
        userCount,
        timestamp: new Date().toISOString()
      }
    })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || 'Server error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
