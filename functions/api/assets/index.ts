// Assets CRUD API (类似 holdings)
// GET    /api/assets     - 获取当前用户所有资产
// POST   /api/assets     - 添加资产
// PUT    /api/assets/:id - 更新资产
// DELETE /api/assets/:id - 删除资产
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
      'SELECT id, data, updated_at FROM assets WHERE user_email = ? ORDER BY updated_at DESC'
    ).bind(email).all<{ id: string; data: string; updated_at: string }>()

    const assets = result.results.map(r => JSON.parse(r.data))
    return json({ ok: true, data: assets })
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
    const asset = { ...body, id, userId: email, updatedAt: now }
    const data = JSON.stringify(asset)

    await context.env.DB.prepare(
      'INSERT INTO assets (id, user_email, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, email, data, now, now).run()

    return json({ ok: true, data: asset }, 201)
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
