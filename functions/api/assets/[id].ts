// PUT    /api/assets/:id
// DELETE /api/assets/:id

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}

function getEmail(request: Request): string | null {
  const auth = request.headers.get('Authorization') || ''
  return auth.replace(/^Bearer\s+/i, '').trim() || null
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const email = getEmail(context.request)
  if (!email) return json({ ok: false, error: 'Unauthorized' }, 401)

  const id = context.params.id as string
  if (!id) return json({ ok: false, error: 'Missing id' }, 400)

  try {
    const body = await context.request.json()
    const now = new Date().toISOString()
    const updated = { ...body, id, updatedAt: now }
    const data = JSON.stringify(updated)

    const existing = await context.env.DB.prepare(
      'SELECT id FROM assets WHERE id = ? AND user_email = ?'
    ).bind(id, email).first()

    if (!existing) {
      await context.env.DB.prepare(
        'INSERT INTO assets (id, user_email, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, email, data, now, now).run()
    } else {
      await context.env.DB.prepare(
        'UPDATE assets SET data = ?, updated_at = ? WHERE id = ? AND user_email = ?'
      ).bind(data, now, id, email).run()
    }

    return json({ ok: true, data: updated })
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const email = getEmail(context.request)
  if (!email) return json({ ok: false, error: 'Unauthorized' }, 401)

  const id = context.params.id as string
  if (!id) return json({ ok: false, error: 'Missing id' }, 400)

  try {
    await context.env.DB.prepare(
      'DELETE FROM assets WHERE id = ? AND user_email = ?'
    ).bind(id, email).run()

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
