const CLOUDFLARE_API_BASE = 'https://wealth-agent.pages.dev/api'

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api'
  
  const hostname = window.location.hostname
  if (/pages\.dev$/.test(hostname)) return '/api'
  
  if (typeof (window as any).electronAPI !== 'undefined') {
    return CLOUDFLARE_API_BASE
  }

  // Capacitor 原生 App（Android/iOS）：WebView 中存在 window.Capacitor
  // 直接调用 Cloudflare Pages API，后端 CORS 已配置 *
  if (typeof (window as any).Capacitor !== 'undefined') {
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
