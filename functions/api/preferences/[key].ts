import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../../server-utils/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  const key = context.params.key as string
  if (!key) return jsonResponse({ ok: false, error: 'Missing key' }, 400)

  try {
    const row = await context.env.DB.prepare(
      'SELECT value, updated_at FROM preferences WHERE user_email = ? AND key = ?'
    ).bind(email, key).first<{ value: string; updated_at: string }>()

    if (!row) return jsonResponse({ ok: true, data: null })

    return jsonResponse({ ok: true, data: { value: JSON.parse(row.value), updatedAt: row.updated_at } })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  const key = context.params.key as string
  if (!key) return jsonResponse({ ok: false, error: 'Missing key' }, 400)

  try {
    const body = await context.request.json() as { value?: any }
    if (body.value === undefined) return jsonResponse({ ok: false, error: 'Missing value' }, 400)

    const value = JSON.stringify(body.value)
    const now = new Date().toISOString()

    await context.env.DB.prepare(
      'INSERT INTO preferences (user_email, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_email, key) DO UPDATE SET value = ?, updated_at = ?'
    ).bind(email, key, value, now, value, now).run()

    return jsonResponse({ ok: true })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  const key = context.params.key as string
  if (!key) return jsonResponse({ ok: false, error: 'Missing key' }, 400)

  try {
    await context.env.DB.prepare(
      'DELETE FROM preferences WHERE user_email = ? AND key = ?'
    ).bind(email, key).run()

    return jsonResponse({ ok: true })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
