import { jwt, getJwtSecret } from './jwt'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export async function getAuthUser(request: Request, env: Record<string, any>): Promise<{ email: string; sub: string } | null> {
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const secret = getJwtSecret(env)
  const payload = await jwt.verify(token, secret)
  if (!payload) return null

  const email = payload.email
  const sub = payload.sub
  if (!email) return null

  return { email, sub: sub || email }
}

export function requireAuth(): Response {
  return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
}

export function optionsResponse(): Response {
  return new Response(null, { headers: CORS_HEADERS })
}
