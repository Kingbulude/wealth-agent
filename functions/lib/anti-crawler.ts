const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
]

const EASTMONEY_REFERERS = [
  'https://www.eastmoney.com/',
  'https://quote.eastmoney.com/',
  'https://data.eastmoney.com/',
  'https://search.eastmoney.com/',
  'https://stock.eastmoney.com/',
]

const SINA_REFERERS = [
  'https://finance.sina.com.cn/',
  'https://stock.sina.com.cn/',
  'https://finance.sina.com.cn/stock/',
]

const TENCENT_REFERERS = [
  'https://gu.qq.com/',
  'https://stock.qq.com/',
  'https://finance.qq.com/',
]

const XUEQIU_REFERERS = [
  'https://xueqiu.com/',
  'https://xueqiu.com/hq',
  'https://xueqiu.com/stock',
]

const THS_REFERERS = [
  'https://www.10jqka.com.cn/',
  'https://stock.10jqka.com.cn/',
]

export function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

export function getRefererForDomain(url: string): string {
  if (url.includes('eastmoney')) {
    return EASTMONEY_REFERERS[Math.floor(Math.random() * EASTMONEY_REFERERS.length)]
  }
  if (url.includes('sina') || url.includes('sinajs')) {
    return SINA_REFERERS[Math.floor(Math.random() * SINA_REFERERS.length)]
  }
  if (url.includes('qq.com') || url.includes('gtimg')) {
    return TENCENT_REFERERS[Math.floor(Math.random() * TENCENT_REFERERS.length)]
  }
  if (url.includes('xueqiu')) {
    return XUEQIU_REFERERS[Math.floor(Math.random() * XUEQIU_REFERERS.length)]
  }
  if (url.includes('10jqka')) {
    return THS_REFERERS[Math.floor(Math.random() * THS_REFERERS.length)]
  }
  return 'https://www.google.com/'
}

export function getRandomDelay(min: number = 500, max: number = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min)) + min
  return new Promise(resolve => setTimeout(resolve, delay))
}

export async function fetchWithAntiCrawler(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), timeoutMs)
  
  const defaultHeaders: Record<string, string> = {
    'User-Agent': getRandomUA(),
    'Referer': getRefererForDomain(url),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  }

  try {
    await getRandomDelay(200, 800)
    return await fetch(url, {
      signal: c.signal,
      headers: { ...defaultHeaders, ...(options.headers as Record<string, string>) },
      ...options
    })
  } finally {
    clearTimeout(t)
  }
}

export function buildRequestHeaders(url: string): Record<string, string> {
  return {
    'User-Agent': getRandomUA(),
    'Referer': getRefererForDomain(url),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
  }
}