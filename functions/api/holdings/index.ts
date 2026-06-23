// GET /api/holdings
// POST /api/holdings
// Header: Authorization: Bearer <email>

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const email = getEmail(context.request)
  if (!email) return json({ ok: false, error: 'Unauthorized' }, 401)

  try {
    const result = await context.env.DB.prepare(
      'SELECT id, data, updated_at FROM holdings WHERE user_email = ? ORDER BY updated_at DESC'
    ).bind(email).all<{ id: string; data: string; updated_at: string }>()

    const holdings = result.results.map(r => ({
      ...JSON.parse(r.data),
      lastSyncedAt: r.updated_at
    }))
    return json({ ok: true, data: holdings })
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500)
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const email = getEmail(context.request)
  if (!email) return json({ ok: false, error: 'Unauthorized' }, 401)

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

    return json({ ok: true, data: holding }, 201)
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
