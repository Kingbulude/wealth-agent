const DEFAULT_SECRET = 'wealth-agent-dev-secret-change-in-production'
const DEFAULT_TTL = 7 * 24 * 60 * 60

function base64UrlEncode(data: Uint8Array): string {
  let str = ''
  for (let i = 0; i < data.length; i++) str += String.fromCharCode(data[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function sign(payload: Record<string, any>, secret: string, ttlSeconds = DEFAULT_TTL): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload = { ...payload, iat: now, exp: now + ttlSeconds }

  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)))
  const message = `${encodedHeader}.${encodedPayload}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  const encodedSignature = base64UrlEncode(new Uint8Array(signature))

  return `${message}.${encodedSignature}`
}

async function verify(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [encodedHeader, encodedPayload, encodedSignature] = parts
    const message = `${encodedHeader}.${encodedPayload}`

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const signatureBytes = base64UrlDecode(encodedSignature)
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(message))
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

export function getJwtSecret(env: Record<string, any>): string {
  const secret = env.JWT_SECRET
  if (secret && secret !== DEFAULT_SECRET) return secret
  console.warn('[JWT] ⚠️  使用默认 JWT_SECRET，生产环境必须配置环境变量 JWT_SECRET')
  return DEFAULT_SECRET
}

export const jwt = { sign, verify }
