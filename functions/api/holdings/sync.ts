// 持仓批量同步接口
// 路由：PUT /api/holdings/sync
// 用途：行情刷新后，把最新的整组持仓（currentPrice 等）一次性落库到 D1
// 鉴权：需要 Bearer Token（与 /api/holdings 一致）
//
// 请求体：
//   { holdings: Holding[] }
// 响应：
//   { ok: true, data: { updated: number } }
//
// 设计说明：
//   - 逐条 upsert：先查存在性，再决定 INSERT / UPDATE，与单条 PUT 接口保持一致
//   - D1 不支持跨语句事务，但每条 SQL 本身是原子的，失败不影响其他记录
//   - 为了控制单次请求耗时，对空字段、缺 id 的脏数据显式跳过

import { getAuthUser, jsonResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  let body: any
  try {
    body = await context.request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const list = Array.isArray(body?.holdings) ? body.holdings : null
  if (!list) {
    return jsonResponse({ ok: false, error: 'Missing `holdings` array in body' }, 400)
  }

  const now = new Date().toISOString()
  let updated = 0
  const skipped: string[] = []

  for (const h of list) {
    if (!h || !h.id || typeof h.id !== 'string') {
      skipped.push(String(h?.id ?? '<no-id>'))
      continue
    }
    const id = h.id
    const data = JSON.stringify({ ...h, userId: email, id })

    try {
      const existing = await context.env.DB.prepare(
        'SELECT id, created_at FROM holdings WHERE id = ? AND user_email = ?'
      ).bind(id, email).first<{ id: string; created_at: string }>()

      if (!existing) {
        await context.env.DB.prepare(
          'INSERT INTO holdings (id, user_email, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, email, data, now, now).run()
      } else {
        // 保留原始 created_at
        await context.env.DB.prepare(
          'UPDATE holdings SET data = ?, updated_at = ? WHERE id = ? AND user_email = ?'
        ).bind(data, now, id, email).run()
      }
      updated += 1
    } catch (e: any) {
      console.error(`[holdings/sync] upsert failed for id=${id}:`, e)
      // 跳过单条失败，继续处理其他
      skipped.push(id)
    }
  }

  return jsonResponse({ ok: true, data: { updated, skipped } })
}
