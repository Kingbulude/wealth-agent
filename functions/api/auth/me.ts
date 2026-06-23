import { getAuthUser, jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const user = await getAuthUser(context.request, context.env)
    if (!user) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const db = context.env.DB
    const dbUser = await db.prepare('SELECT id, email, created_at FROM users WHERE email = ?')
      .bind(user.email)
      .first<{ id: string; email: string; created_at: string }>()

    if (!dbUser) {
      return jsonResponse({ ok: false, error: 'User not found' }, 404)
    }

    return jsonResponse({
      ok: true,
      data: { id: dbUser.id, email: dbUser.email, createdAt: dbUser.created_at }
    })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || 'Server error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
