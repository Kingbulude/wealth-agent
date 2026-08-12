const PBKDF2_ITERATIONS = 100000
const SALT_BYTES = 16
const HASH_BYTES = 32

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    HASH_BYTES * 8
  )
  const hash = new Uint8Array(hashBuffer)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`
}

function verifyLegacyHash(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('_')
    if (parts.length !== 3 || parts[0] !== 'h') return false
    const salt = parts[2]
    let hash = 0
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i)
      hash = ((hash << 5) - hash + char + salt.charCodeAt(i % salt.length)) | 0
    }
    const computed = Math.abs(hash).toString(36)
    return computed === parts[1]
  } catch {
    return false
  }
}

export function isLegacyHash(storedHash: string): boolean {
  return storedHash.startsWith('h_')
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (isLegacyHash(storedHash)) {
      return verifyLegacyHash(password, storedHash)
    }

    const parts = storedHash.split('$')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

    const iterations = parseInt(parts[1], 10)
    const salt = hexToBytes(parts[2])
    const expectedHash = parts[3]

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      HASH_BYTES * 8
    )
    const actualHash = bytesToHex(new Uint8Array(hashBuffer))
    return actualHash === expectedHash
  } catch {
    return false
  }
}
