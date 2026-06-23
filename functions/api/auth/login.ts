import { verifyPassword } from '../../lib/password'
import { jwt, getJwtSecret } from '../../lib/jwt'
import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { email, password } = await context.request.json() as { email?: string; password?: string }
    if (!email || !password) {
      return jsonResponse({ ok: false, error: 'Email and password required' }, 400)
    }

    const db = context.env.DB
    const user = await db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; password_hash: string; created_at: string }>()

    if (!user) {
      return jsonResponse({ ok: false, error: 'User not found' }, 404)
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return jsonResponse({ ok: false, error: 'Invalid password' }, 401)
    }

    const secret = getJwtSecret(context.env)
    const token = await jwt.sign({ sub: user.id, email: user.email }, secret)

    return jsonResponse({
      ok: true,
      data: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        token
      }
    })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || 'Server error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
