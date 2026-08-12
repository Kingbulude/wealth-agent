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
      'SELECT id, user_email, category, title, content_json, content_text, tags, is_pinned, is_archived, related_holding_id, created_at, updated_at FROM notes WHERE id = ? AND user_email = ?'
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
    const now = new Date().toISOString()
    const existing = await context.env.DB.prepare(
      'SELECT id FROM notes WHERE id = ? AND user_email = ?'
    ).bind(id, email).first()

    if (!existing) {
      const created = {
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
        created_at: now,
        updated_at: now
      }
      await context.env.DB.prepare(`
        INSERT INTO notes (id, user_email, category, title, content_json, content_text, tags, is_pinned, is_archived, related_holding_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        created.id, created.user_email, created.category, created.title, created.content_json,
        created.content_text, created.tags, created.is_pinned, created.is_archived,
        created.related_holding_id, created.created_at, created.updated_at
      ).run()
      return jsonResponse({ ok: true, data: created })
    } else {
      const updates: string[] = []
      const params: any[] = []
      const allowed = ['category', 'title', 'content_json', 'content_text', 'tags', 'related_holding_id']
      for (const key of allowed) {
        if (key in body) {
          updates.push(`${key} = ?`)
          params.push(body[key] ?? null)
        }
      }
      if ('is_pinned' in body) {
        updates.push('is_pinned = ?')
        params.push(body.is_pinned ? 1 : 0)
      }
      if ('is_archived' in body) {
        updates.push('is_archived = ?')
        params.push(body.is_archived ? 1 : 0)
      }
      updates.push('updated_at = ?')
      params.push(now)
      params.push(id, email)
      await context.env.DB.prepare(
        `UPDATE notes SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`
      ).bind(...params).run()
      return jsonResponse({ ok: true, data: { id, updated_at: now } })
    }
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
      'DELETE FROM notes WHERE id = ? AND user_email = ?'
    ).bind(id, email).run()
    return jsonResponse({ ok: true, data: { id } })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
