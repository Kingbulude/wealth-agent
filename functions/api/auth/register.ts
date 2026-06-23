import { hashPassword } from '../../../server-utils/password'
import { jwt, getJwtSecret } from '../../../server-utils/jwt'
import { jsonResponse, optionsResponse } from '../../../server-utils/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { email, password } = await context.request.json() as { email?: string; password?: string }
    if (!email || !password || password.length < 4) {
      return jsonResponse({ ok: false, error: 'Invalid email or password (min 4 chars)' }, 400)
    }

    const db = context.env.DB

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) {
      return jsonResponse({ ok: false, error: 'Email already registered' }, 409)
    }

    const id = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

    await db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, email, passwordHash, now)
      .run()

    const secret = getJwtSecret(context.env)
    const token = await jwt.sign({ sub: id, email }, secret)

    return jsonResponse({
      ok: true,
      data: { id, email, createdAt: now, token }
    })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || 'Server error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
