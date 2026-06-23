// User preferences API (key-value store)
// GET    /api/preferences/:key
// PUT    /api/preferences/:key  body: { value: any }
// Header: Authorization: Bearer <email>
//
// 适用场景：自定义资产类型、UI 偏好、关注列表、AI 投顾历史等所有用户级配置

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
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

  const key = context.params.key as string
  if (!key) return json({ ok: false, error: 'Missing key' }, 400)

  try {
    const row = await context.env.DB.prepare(
      'SELECT value, updated_at FROM preferences WHERE user_email = ? AND key = ?'
    ).bind(email, key).first<{ value: string; updated_at: string }>()

    if (!row) return json({ ok: true, data: null })

    return json({ ok: true, data: { value: JSON.parse(row.value), updatedAt: row.updated_at } })
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500)
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const email = getEmail(context.request)
  if (!email) return json({ ok: false, error: 'Unauthorized' }, 401)

  const key = context.params.key as string
  if (!key) return json({ ok: false, error: 'Missing key' }, 400)

  try {
    const body = await context.request.json() as { value?: any }
    if (body.value === undefined) return json({ ok: false, error: 'Missing value' }, 400)

    const value = JSON.stringify(body.value)
    const now = new Date().toISOString()

    await context.env.DB.prepare(
      'INSERT INTO preferences (user_email, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_email, key) DO UPDATE SET value = ?, updated_at = ?'
    ).bind(email, key, value, now, value, now).run()

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const email = getEmail(context.request)
  if (!email) return json({ ok: false, error: 'Unauthorized' }, 401)

  const key = context.params.key as string
  if (!key) return json({ ok: false, error: 'Missing key' }, 400)

  try {
    await context.env.DB.prepare(
      'DELETE FROM preferences WHERE user_email = ? AND key = ?'
    ).bind(email, key).run()

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
