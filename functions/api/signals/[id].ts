// /api/signals/:id
// PUT    - 更新决策信号
// DELETE - 删除决策信号

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const id = context.params.id as string
    const body = await context.request.json()
    const { action, score, status, reason, stop_loss, target_price, expired_at } = body

    // 先检查信号是否存在且属于当前用户
    const { results } = await context.env.DB.prepare(
      `SELECT * FROM decision_signals WHERE id = ? AND user_id = ?`
    ).bind(id, user.id).all()

    if (!results || results.length === 0) {
      return jsonResponse({ ok: false, error: '信号不存在或无权限' }, 404)
    }

    // 构建更新SQL
    const updates: string[] = []
    const params: any[] = []

    if (action !== undefined) { updates.push('action = ?'); params.push(action) }
    if (score !== undefined) { updates.push('score = ?'); params.push(score) }
    if (status !== undefined) { updates.push('status = ?'); params.push(status) }
    if (reason !== undefined) { updates.push('reason = ?'); params.push(reason) }
    if (stop_loss !== undefined) { updates.push('stop_loss = ?'); params.push(stop_loss) }
    if (target_price !== undefined) { updates.push('target_price = ?'); params.push(target_price) }
    if (expired_at !== undefined) { updates.push('expired_at = ?'); params.push(expired_at) }

    if (updates.length === 0) {
      return jsonResponse({ ok: false, error: 'no fields to update' }, 400)
    }

    params.push(id, user.id)

    await context.env.DB.prepare(
      `UPDATE decision_signals SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...params).run()

    return jsonResponse({ ok: true, message: '更新成功' })

  } catch (e: any) {
    console.error('[signals] 更新错误:', e)
    return jsonResponse({ ok: false, error: e.message || '更新失败' }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const id = context.params.id as string

    await context.env.DB.prepare(
      `DELETE FROM decision_signals WHERE id = ? AND user_id = ?`
    ).bind(id, user.id).run()

    return jsonResponse({ ok: true, message: '删除成功' })

  } catch (e: any) {
    console.error('[signals] 删除错误:', e)
    return jsonResponse({ ok: false, error: e.message || '删除失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
