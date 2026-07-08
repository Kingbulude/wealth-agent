export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api'
  
  const hostname = window.location.hostname
  if (/pages\.dev$/.test(hostname)) return '/api'
  
  if (typeof (window as any).electronAPI !== 'undefined') {
    return 'https://kingbulude.github.io/api'
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
