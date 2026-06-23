import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  const id = context.params.id as string
  if (!id) return jsonResponse({ ok: false, error: 'Missing id' }, 400)

  try {
    const body = await context.request.json()
    const now = new Date().toISOString()
    const updated = { ...body, id, lastUpdated: now }
    const data = JSON.stringify(updated)

    const existing = await context.env.DB.prepare(
      'SELECT id FROM holdings WHERE id = ? AND user_email = ?'
    ).bind(id, email).first()

    if (!existing) {
      await context.env.DB.prepare(
        'INSERT INTO holdings (id, user_email, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, email, data, now, now).run()
    } else {
      await context.env.DB.prepare(
        'UPDATE holdings SET data = ?, updated_at = ? WHERE id = ? AND user_email = ?'
      ).bind(data, now, id, email).run()
    }

    return jsonResponse({ ok: true, data: updated })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  const id = context.params.id as string
  if (!id) return jsonResponse({ ok: false, error: 'Missing id' }, 400)

  try {
    await context.env.DB.prepare(
      'DELETE FROM holdings WHERE id = ? AND user_email = ?'
    ).bind(id, email).run()

    return jsonResponse({ ok: true })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
