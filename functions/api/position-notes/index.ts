import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

// GET /api/position-notes?holding_id=xxx
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  try {
    const url = new URL(context.request.url)
    const holdingId = url.searchParams.get('holding_id') || ''
    let sql = 'SELECT * FROM position_trade_records WHERE user_email = ?'
    const params: any[] = [email]
    if (holdingId) {
      sql += ' AND holding_id = ?'
      params.push(holdingId)
    }
    sql += ' ORDER BY record_time DESC LIMIT 500'
    const result = await context.env.DB.prepare(sql).bind(...params).all<any>()
    return jsonResponse({ ok: true, data: result.results })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

// POST /api/position-notes
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  try {
    const body = await context.request.json() as any
    if (!body.holding_id || !body.action || body.price == null || body.quantity == null || !body.reason) {
      return jsonResponse({ ok: false, error: 'Missing required fields' }, 400)
    }
    const id = body.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const record = {
      id,
      user_email: email,
      holding_id: body.holding_id,
      action: body.action,
      price: Number(body.price),
      quantity: Number(body.quantity),
      reason: String(body.reason),
      target_price: body.target_price != null ? Number(body.target_price) : null,
      stop_loss_price: body.stop_loss_price != null ? Number(body.stop_loss_price) : null,
      holding_period: body.holding_period || null,
      market_context: body.market_context || null,
      record_time: body.record_time || now,
      created_at: now
    }
    await context.env.DB.prepare(`
      INSERT INTO position_trade_records (id, user_email, holding_id, action, price, quantity, reason, target_price, stop_loss_price, holding_period, market_context, record_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.id, record.user_email, record.holding_id, record.action, record.price,
      record.quantity, record.reason, record.target_price, record.stop_loss_price,
      record.holding_period, record.market_context, record.record_time, record.created_at
    ).run()
    return jsonResponse({ ok: true, data: record }, 201)
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
