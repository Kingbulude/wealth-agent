// POST /api/auth/register
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
  // 简单 bcrypt-like hash（生产环境建议用 bcryptjs）
  // 这里用 PBKDF2 风格的简单实现，避免引入外部依赖
  const salt = password.slice(0, 3) + password.slice(-3)
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash + char + salt.charCodeAt(i % salt.length)) | 0
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + salt
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { email, password } = await context.request.json() as { email?: string; password?: string }
    if (!email || !password || password.length < 4) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email or password (min 4 chars)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    const db = context.env.DB

    // 检查是否已存在
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) {
      return new Response(JSON.stringify({ ok: false, error: 'Email already registered' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    const id = crypto.randomUUID()
    const passwordHash = hashPassword(password)
    const now = new Date().toISOString()

    await db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, email, passwordHash, now)
      .run()

    return new Response(JSON.stringify({ ok: true, data: { id, email, createdAt: now } }), {
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
