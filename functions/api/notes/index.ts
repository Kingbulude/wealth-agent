import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

// GET /api/notes?category=cognition&q=keyword
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  try {
    const url = new URL(context.request.url)
    const category = url.searchParams.get('category') || ''
    const q = (url.searchParams.get('q') || '').trim()
    const includeArchived = url.searchParams.get('include_archived') === '1'

    let sql = 'SELECT id, user_email, category, title, content_json, content_text, tags, is_pinned, is_archived, related_holding_id, created_at, updated_at FROM notes WHERE user_email = ?'
    const params: any[] = [email]

    if (category) {
      sql += ' AND category = ?'
      params.push(category)
    }
    if (!includeArchived) {
      sql += ' AND is_archived = 0'
    }
    if (q) {
      sql += ' AND (LOWER(IFNULL(title, "")) LIKE ? OR LOWER(IFNULL(content_text, "")) LIKE ?)'
      const like = `%${q.toLowerCase()}%`
      params.push(like, like)
    }
    sql += ' ORDER BY is_pinned DESC, updated_at DESC LIMIT 500'

    const result = await context.env.DB.prepare(sql).bind(...params).all<any>()
    return jsonResponse({ ok: true, data: result.results })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

// POST /api/notes
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()
  const email = user.email

  try {
    const body = await context.request.json() as any
    const id = body.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const note = {
      id,
      user_email: email,
      category: body.category || 'cognition',
      title: body.title || '',
      content_json: body.content_json || '{}',
      content_text: body.content_text || '',
      tags: body.tags || '',
      is_pinned: body.is_pinned ? 1 : 0,
      is_archived: body.is_archived ? 1 : 0,
      related_holding_id: body.related_holding_id || null,
      created_at: body.created_at || now,
      updated_at: now
    }

    await context.env.DB.prepare(`
      INSERT INTO notes (id, user_email, category, title, content_json, content_text, tags, is_pinned, is_archived, related_holding_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      note.id, note.user_email, note.category, note.title, note.content_json,
      note.content_text, note.tags, note.is_pinned, note.is_archived,
      note.related_holding_id, note.created_at, note.updated_at
    ).run()

    return jsonResponse({ ok: true, data: note }, 201)
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
