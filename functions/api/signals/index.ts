// /api/signals
// GET  - 获取当前用户的决策信号列表
// POST - 创建新决策信号

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const url = new URL(context.request.url)
    const status = url.searchParams.get('status') || 'active'
    const symbol = url.searchParams.get('symbol')

    let sql = `SELECT * FROM decision_signals WHERE user_id = ?`
    const params: any[] = [user.id]

    if (status !== 'all') {
      sql += ` AND status = ?`
      params.push(status)
    }

    if (symbol) {
      sql += ` AND symbol = ?`
      params.push(symbol)
    }

    sql += ` ORDER BY created_at DESC`

    const { results } = await context.env.DB.prepare(sql).bind(...params).all()

    return jsonResponse({
      ok: true,
      data: results || []
    })

  } catch (e: any) {
    console.error('[signals] 查询错误:', e)
    return jsonResponse({ ok: false, error: e.message || '查询失败' }, 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const body = await context.request.json()
    const {
      symbol, name, action, score, horizon,
      source = 'manual', strategy, reason,
      stop_loss, target_price, expired_at
    } = body

    if (!symbol || !name || !action) {
      return jsonResponse({ ok: false, error: 'symbol, name, action required' }, 400)
    }

    const now = new Date().toISOString()

    const result = await context.env.DB.prepare(
      `INSERT INTO decision_signals
       (user_id, symbol, name, action, score, horizon, source, status, strategy, reason, stop_loss, target_price, created_at, expired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.id, symbol, name, action, score || null, horizon || null,
      source, strategy || null, reason || null,
      stop_loss || null, target_price || null, now, expired_at || null
    ).run()

    return jsonResponse({
      ok: true,
      data: { id: result.meta?.last_row_id, ...body, user_id: user.id, status: 'active', created_at: now }
    })

  } catch (e: any) {
    console.error('[signals] 创建错误:', e)
    return jsonResponse({ ok: false, error: e.message || '创建失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
