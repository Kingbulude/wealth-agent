const CLOUDFLARE_API_BASE = 'https://wealth-agent.pages.dev/api'

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api'

  // Electron 桌面端：直接请求 Cloudflare API（CORS 已配置 *）
  if (typeof (window as any).electronAPI !== 'undefined') {
    return CLOUDFLARE_API_BASE
  }

  // Cloudflare Pages 部署：同源 /api
  const hostname = window.location.hostname
  if (/pages\.dev$/.test(hostname)) return '/api'

  // 本地开发：同源 /api（Vite proxy 或本地 Functions）
  return '/api'
}

export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl()
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`
  }
  return `${baseUrl}/${path}`
}
