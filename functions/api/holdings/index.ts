import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  try {
    const result = await context.env.DB.prepare(
      'SELECT id, data, updated_at FROM holdings WHERE user_email = ? ORDER BY updated_at DESC'
    ).bind(email).all<{ id: string; data: string; updated_at: string }>()

    const holdings = result.results.map(r => ({
      ...JSON.parse(r.data),
      lastSyncedAt: r.updated_at
    }))
    return jsonResponse({ ok: true, data: holdings })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  try {
    const body = await context.request.json()
    const id = body.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const holding = {
      ...body,
      id,
      userId: email,
      lastUpdated: now
    }
    const data = JSON.stringify(holding)

    await context.env.DB.prepare(
      'INSERT INTO holdings (id, user_email, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, email, data, now, now).run()

    return jsonResponse({ ok: true, data: holding }, 201)
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
