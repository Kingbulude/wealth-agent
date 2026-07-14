const CLOUDFLARE_API_BASE = 'https://wealth-agent.pages.dev/api'

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api'
  
  const hostname = window.location.hostname
  if (/pages\.dev$/.test(hostname)) return '/api'
  
  if (typeof (window as any).electronAPI !== 'undefined') {
    return CLOUDFLARE_API_BASE
  }
  
  return '/api'
}

export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl()
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`
  }
  return `${baseUrl}/${path}`
}
