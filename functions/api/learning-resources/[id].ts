import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  const id = context.params.id as string
  if (!id) return jsonResponse({ ok: false, error: 'Missing id' }, 400)

  try {
    const result = await context.env.DB.prepare(
      'SELECT * FROM learning_resources WHERE id = ? AND user_email = ?'
    ).bind(id, email).first<any>()
    if (!result) return jsonResponse({ ok: false, error: 'Not found' }, 404)
    return jsonResponse({ ok: true, data: result })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  const id = context.params.id as string
  if (!id) return jsonResponse({ ok: false, error: 'Missing id' }, 400)

  try {
    const body = await context.request.json() as any
    const updates: string[] = []
    const params: any[] = []
    const allowed = ['title', 'url', 'type', 'tags', 'notes']
    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`)
        params.push(body[key] ?? null)
      }
    }
    if (updates.length === 0) {
      return jsonResponse({ ok: false, error: 'No fields to update' }, 400)
    }
    params.push(id, email)
    await context.env.DB.prepare(
      `UPDATE learning_resources SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`
    ).bind(...params).run()
    return jsonResponse({ ok: true, data: { id } })
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
      'DELETE FROM learning_resources WHERE id = ? AND user_email = ?'
    ).bind(id, email).run()
    return jsonResponse({ ok: true, data: { id } })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
