// POST /api/auth/login
// Body: { email, password }

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function hashPassword(password: string): string {
  const salt = password.slice(0, 3) + password.slice(-3)
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash + char + salt.charCodeAt(i % salt.length)) | 0
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + salt
}

function generateToken(): string {
  return 'tk_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { email, password } = await context.request.json() as { email?: string; password?: string }
    if (!email || !password) {
      return new Response(JSON.stringify({ ok: false, error: 'Email and password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    const db = context.env.DB
    const user = await db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; password_hash: string; created_at: string }>()

    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    if (user.password_hash !== hashPassword(password)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    const token = generateToken()

    return new Response(JSON.stringify({
      ok: true,
      data: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        token
      }
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
