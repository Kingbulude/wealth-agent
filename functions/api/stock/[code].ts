// Cloudflare Pages Function: 股票行情代理
// 路径: /api/stock/:code
// 多源并发：东财 + 腾讯 + 新浪（主），网易兜底
// 关键修复：
//   1) 东财 f43/f44/f45/f60 是「分」单位（×100），需 ÷100
//   2) 腾讯 d[30] 才是时间戳，不是 d[d.length-1]
//   3) 新浪 d[0] 是 GBK 编码的名称，要用 TextDecoder('gbk') 解码
//   4) 价格合理性校验：0.01~10000 元，且与昨收偏差不超过 30%

interface Env {}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=10'
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function getExchangeCode(code: string): string {
  if (/^\d{5}$/.test(code)) return '116'
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return '1'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return '0'
  if (code.startsWith('4') || code.startsWith('8')) return '8'
  return '1'
}

function isHKStock(code: string): boolean {
  return /^\d{5}$/.test(code)
}

function getMarket(code: string): 'sh' | 'sz' | 'bj' | 'hk' {
  if (/^\d{5}$/.test(code)) return 'hk'
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'sh'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return 'sz'
  return 'bj'
}

async function fetchWithTimeout(url: string, ms = 5000, referer = 'https://quote.eastmoney.com/'): Promise<Response> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    return await fetch(url, {
      signal: c.signal,
      headers: { 'User-Agent': UA, 'Referer': referer }
    })
  } finally {
    clearTimeout(t)
  }
}

/**
 * 价格合理性校验
 * - 必须 > 0
 * - 不能高于 10000 元（普通 A 股不会超过茅台 2000+）
 * - 不能低于 0.01 元
 * - 与昨收偏差不能超过 30%（防数据源异常）
 */
function isValidPrice(price: number, prevClose: number): boolean {
  if (!isFinite(price) || price <= 0) return false
  if (price < 0.01 || price > 10000) return false
  if (isFinite(prevClose) && prevClose > 0) {
    const deviation = Math.abs(price - prevClose) / prevClose
    if (deviation > 0.3) return false // 单日波动超 30% 视为异常
  }
  return true
}

/**
 * 解析东财时间戳（秒） -> 可读字符串
 */
function formatEastTime(ts: string | number | undefined): string {
  if (!ts) return ''
  const n = parseFloat(String(ts))
  if (!isFinite(n) || n <= 0) return ''
  // 东财时间戳是秒级，10位左右
  const ms = n > 1e12 ? n : n * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', { hour12: false })
}

/**
 * 东财：push2.eastmoney.com
 * f57=代码 f58=名称 f43=当前价(分) f44=最高价(分) f45=最低价(分)
 * f60=昨收(分) f92=涨跌幅(%) f86=时间戳(秒)
 * ⚠️ 价格字段全是「分」单位，必须 ÷100
 */
async function fromEastMoney(code: string): Promise<any | null> {
  try {
    const ex = getExchangeCode(code)
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${ex}.${code}&fields=f43,f44,f45,f57,f58,f60,f92,f86`
    const r = await fetchWithTimeout(url)
    const j: any = await r.json()
    if (!j.data) return null

    const priceDivisor = isHKStock(code) ? 1000 : 100
    const rawPrice = parseFloat(j.data.f43)
    const prevClose = (parseFloat(j.data.f60) || 0) / priceDivisor
    const price = rawPrice / priceDivisor
    const high = (parseFloat(j.data.f44) || 0) / priceDivisor
    const low = (parseFloat(j.data.f45) || 0) / priceDivisor

    if (!isValidPrice(price, prevClose)) {
      console.warn(`[eastmoney] ${code} invalid price=${price} prevClose=${prevClose}, skip`)
      return null
    }

    const change = price - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    return {
      code: j.data.f57 || code,
      name: j.data.f58 || '',
      price,
      prevClose,
      open: prevClose,
      change,
      changePercent,
      high,
      low,
      updateTime: formatEastTime(j.data.f86),
      source: 'eastmoney'
    }
  } catch (e) {
    console.warn('[eastmoney] error:', (e as Error).message)
  }
  return null
}

/**
 * 腾讯：qt.gtimg.cn，返回 GBK 编码
 * 字段：d[0]=未知 d[1]=名称 d[2]=代码 d[3]=当前价 d[4]=昨收 d[5]=今开
 *       d[6~29]=买卖五档 d[30]=时间戳(yyyyMMddHHmmss)
 *       d[31]=涨跌额 d[32]=涨跌幅 d[33]=最高 d[34]=最低
 * ⚠️ d[30] 才是时间戳，d[d.length-1] 是别的字段
 */
async function fromTencent(code: string): Promise<any | null> {
  try {
    const ex = getMarket(code)
    const url = `https://qt.gtimg.cn/q=${ex}${code}`
    const r = await fetchWithTimeout(url, 5000, 'https://gu.qq.com/')
    const buf = await r.arrayBuffer()
    const t = new TextDecoder('gbk').decode(buf)
    const m = t.match(/v_[\w]+="([^"]+)"/)
    if (!m) return null
    const d = m[1].split('~')
    if (d.length < 35) return null

    const price = parseFloat(d[3]) || 0
    const prevClose = parseFloat(d[4]) || 0
    if (!isValidPrice(price, prevClose)) {
      console.warn(`[tencent] ${code} invalid price=${price} prevClose=${prevClose}, skip`)
      return null
    }

    // d[30] 形如 "20260623142843"
    const updateTime = d[30] && /^\d{14}$/.test(d[30])
      ? `${d[30].slice(0, 4)}-${d[30].slice(4, 6)}-${d[30].slice(6, 8)} ${d[30].slice(8, 10)}:${d[30].slice(10, 12)}:${d[30].slice(12, 14)}`
      : ''

    const change = price - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    return {
      code,
      name: d[1] || '',
      price,
      prevClose,
      open: parseFloat(d[5]) || 0,
      change,
      changePercent,
      high: parseFloat(d[33]) || 0,
      low: parseFloat(d[34]) || 0,
      updateTime,
      source: 'tencent'
    }
  } catch (e) {
    console.warn('[tencent] error:', (e as Error).message)
  }
  return null
}

/**
 * 新浪：hq.sinajs.cn，返回 GBK 编码
 * 字段：d[0]=名称(GBK) d[1]=今开 d[2]=昨收 d[3]=当前价 d[4]=最高 d[5]=最低
 *       ...
 *       d[30]=日期 d[31]=时间
 */
async function fromSina(code: string): Promise<any | null> {
  try {
    const ex = getMarket(code)
    const url = `https://hq.sinajs.cn/list=${ex}${code}`
    const r = await fetchWithTimeout(url, 5000, 'https://finance.sina.com.cn/')
    const buf = await r.arrayBuffer()
    const t = new TextDecoder('gbk').decode(buf)
    const m = t.match(/var hq_str_[\w]+="([^"]+)"/)
    if (!m) return null
    const d = m[1].split(',')
    if (d.length < 32) return null

    const price = parseFloat(d[3]) || 0
    const prevClose = parseFloat(d[2]) || 0
    if (!isValidPrice(price, prevClose)) {
      console.warn(`[sina] ${code} invalid price=${price} prevClose=${prevClose}, skip`)
      return null
    }

    const updateTime = d[30] && d[31] ? `${d[30]} ${d[31]}` : ''

    return {
      code,
      name: d[0] || '',
      price,
      prevClose,
      open: parseFloat(d[1]) || 0,
      change: price - prevClose,
      changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      high: parseFloat(d[4]) || 0,
      low: parseFloat(d[5]) || 0,
      updateTime,
      source: 'sina'
    }
  } catch (e) {
    console.warn('[sina] error:', (e as Error).message)
  }
  return null
}

/**
 * 网易：api.money.126.net（部分 IP 被风控，兜底用）
 */
async function fromNetEase(code: string): Promise<any | null> {
  try {
    const ex = code.startsWith('6') ? '0' : '1'
    const url = `https://api.money.126.net/data/feed/${ex}${code},money.api`
    const r = await fetchWithTimeout(url, 4000, 'https://money.126.com/')
    const t = await r.text()
    const m = t.match(/\{[\s\S]*\}/)
    if (!m) return null
    const j = JSON.parse(m[0])
    const k = `${ex}${code}`
    if (!j[k]) return null

    const price = parseFloat(j[k].price) || 0
    const prevClose = parseFloat(j[k].yestclose) || 0
    if (!isValidPrice(price, prevClose)) {
      console.warn(`[netease] ${code} invalid price=${price} prevClose=${prevClose}, skip`)
      return null
    }

    const change = price - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    return {
      code,
      name: j[k].name || '',
      price,
      prevClose,
      open: parseFloat(j[k].open) || 0,
      change,
      changePercent,
      high: parseFloat(j[k].high) || 0,
      low: parseFloat(j[k].low) || 0,
      updateTime: j[k].time || '',
      source: 'netease'
    }
  } catch (e) {
    // 网易经常被风控，静默失败
  }
  return null
}

/**
 * 多源结果择优
 * 优先级：腾讯 > 东财 > 新浪 > 网易
 * 同票多个源都成功时，挑当前价最接近「中位数」的那一个（防单源异常）
 */
function pickBest(results: any[]): any | null {
  if (results.length === 0) return null
  // 先按价格排序
  const sorted = [...results].sort((a, b) => a.price - b.price)
  const median = sorted[Math.floor(sorted.length / 2)].price
  // 选离中位数最近的
  let best = results[0]
  let bestDiff = Math.abs(results[0].price - median)
  for (const r of results) {
    const diff = Math.abs(r.price - median)
    if (diff < bestDiff) {
      best = r
      bestDiff = diff
    }
  }
  return best
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = context.params.code as string
  // 支持 A股 6位 / 港股 5位
  if (!code || !/^\d{5,6}$/.test(code)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid stock code, need 5-6 digits' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  // 多源并发请求
  const [eastRes, tencentRes, sinaRes, neteaseRes] = await Promise.allSettled([
    fromEastMoney(code),
    fromTencent(code),
    fromSina(code),
    fromNetEase(code)
  ])

  const successes: any[] = []
  const failed: string[] = []
  for (const [name, r] of [
    ['eastmoney', eastRes],
    ['tencent', tencentRes],
    ['sina', sinaRes],
    ['netease', neteaseRes]
  ] as const) {
    if (r.status === 'fulfilled' && r.value) {
      successes.push(r.value)
    } else {
      failed.push(name)
    }
  }

  if (successes.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'All sources failed', failed }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  // 只有一个源成功就直接用，多个源成功时挑最接近中位数的
  const data = successes.length === 1 ? successes[0] : pickBest(successes)

  return new Response(JSON.stringify({
    ok: true,
    data,
    _meta: {
      sources: successes.map(s => s.source),
      failedSources: failed
    }
  }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
