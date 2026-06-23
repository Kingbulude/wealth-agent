// GET /api/auth/me
// Header: Authorization: Bearer <token>

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const auth = context.request.headers.get('Authorization') || ''
    const email = auth.replace(/^Bearer\s+/i, '')

    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    const db = context.env.DB
    const user = await db.prepare('SELECT id, email, created_at FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; created_at: string }>()

    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      data: { id: user.id, email: user.email, createdAt: user.created_at }
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
