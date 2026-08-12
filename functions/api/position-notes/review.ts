import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

// GET /api/position-notes/review?holding_id=xxx
// POST /api/position-notes/review
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  try {
    const url = new URL(context.request.url)
    const holdingId = url.searchParams.get('holding_id') || ''
    let sql = 'SELECT * FROM position_review_notes WHERE user_email = ?'
    const params: any[] = [email]
    if (holdingId) {
      sql += ' AND holding_id = ?'
      params.push(holdingId)
    }
    sql += ' ORDER BY created_at DESC LIMIT 500'
    const result = await context.env.DB.prepare(sql).bind(...params).all<any>()
    return jsonResponse({ ok: true, data: result.results })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  try {
    const body = await context.request.json() as any
    if (!body.holding_id || !body.content_json) {
      return jsonResponse({ ok: false, error: 'Missing required fields' }, 400)
    }
    const id = body.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const note = {
      id,
      user_email: email,
      holding_id: body.holding_id,
      content_json: body.content_json,
      content_text: body.content_text || '',
      price_snapshot: body.price_snapshot != null ? Number(body.price_snapshot) : null,
      profit_pct_snapshot: body.profit_pct_snapshot != null ? Number(body.profit_pct_snapshot) : null,
      created_at: now
    }
    await context.env.DB.prepare(`
      INSERT INTO position_review_notes (id, user_email, holding_id, content_json, content_text, price_snapshot, profit_pct_snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      note.id, note.user_email, note.holding_id, note.content_json, note.content_text,
      note.price_snapshot, note.profit_pct_snapshot, note.created_at
    ).run()
    return jsonResponse({ ok: true, data: note }, 201)
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
