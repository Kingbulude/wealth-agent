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
    const url = new URL(context.request.url)
    const type = url.searchParams.get('type') || ''
    let sql = 'SELECT * FROM learning_resources WHERE user_email = ?'
    const params: any[] = [email]
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
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
    if (!body.title || !body.url || !body.type) {
      return jsonResponse({ ok: false, error: 'Missing required fields' }, 400)
    }
    const id = body.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const resource = {
      id,
      user_email: email,
      title: body.title,
      url: body.url,
      type: body.type,
      tags: body.tags || '',
      notes: body.notes || '',
      created_at: now
    }
    await context.env.DB.prepare(`
      INSERT INTO learning_resources (id, user_email, title, url, type, tags, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      resource.id, resource.user_email, resource.title, resource.url,
      resource.type, resource.tags, resource.notes, resource.created_at
    ).run()
    return jsonResponse({ ok: true, data: resource }, 201)
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
