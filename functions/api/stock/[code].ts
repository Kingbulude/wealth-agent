// Cloudflare Pages Function: 股票行情代理
// 路径: /api/stock/:code
// 多源回退：东财 → 腾讯 → 网易

interface Env {}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=10'
}

function getExchangeCode(code: string): string {
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return '1'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return '0'
  if (code.startsWith('4') || code.startsWith('8')) return '8'
  return '1'
}

function getMarket(code: string): 'sh' | 'sz' | 'bj' {
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'sh'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return 'sz'
  return 'bj'
}

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    return await fetch(url, {
      signal: c.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    })
  } finally {
    clearTimeout(t)
  }
}

async function fromEastMoney(code: string): Promise<any | null> {
  try {
    const ex = getExchangeCode(code)
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${ex}.${code}&fields=f57,f58,f116,f117,f43,f44,f92,f175,f86,f60`
    const r = await fetchWithTimeout(url)
    const j: any = await r.json()
    if (j.data && parseFloat(j.data.f43) > 0) {
      return {
        code: j.data.f57,
        name: j.data.f58,
        price: parseFloat(j.data.f43) || 0,
        prevClose: parseFloat(j.data.f116) || 0,
        open: parseFloat(j.data.f117) || 0,
        change: parseFloat(j.data.f44) || 0,
        changePercent: parseFloat(j.data.f92) || 0,
        high: parseFloat(j.data.f86) || 0,
        low: parseFloat(j.data.f60) || 0,
        updateTime: j.data.f175 || '',
        source: 'eastmoney'
      }
    }
  } catch (e) {}
  return null
}

async function fromTencent(code: string): Promise<any | null> {
  try {
    const ex = getMarket(code)
    const url = `https://qt.gtimg.cn/q=${ex}${code}`
    const r = await fetchWithTimeout(url)
    const t = await r.text()
    const m = t.match(/v_[\w]+="([^"]+)"/)
    if (m) {
      const d = m[1].split('~')
      if (d.length >= 6) {
        const price = parseFloat(d[3]) || 0
        if (price > 0) {
          return {
            code,
            name: d[1],
            price,
            prevClose: parseFloat(d[4]) || 0,
            open: parseFloat(d[5]) || 0,
            change: parseFloat(d[31]) || (price - (parseFloat(d[4]) || 0)),
            changePercent: parseFloat(d[32]) || 0,
            high: parseFloat(d[33]) || 0,
            low: parseFloat(d[34]) || 0,
            updateTime: d[d.length - 1] || '',
            source: 'tencent'
          }
        }
      }
    }
  } catch (e) {}
  return null
}

async function fromNetEase(code: string): Promise<any | null> {
  try {
    const ex = code.startsWith('6') ? '0' : '1'
    const url = `https://api.money.126.net/data/feed/${ex}${code},money.api`
    const r = await fetchWithTimeout(url)
    const t = await r.text()
    const m = t.match(/\{[\s\S]*\}/)
    if (m) {
      const j = JSON.parse(m[0])
      const k = `${ex}${code}`
      if (j[k] && parseFloat(j[k].price) > 0) {
        return {
          code,
          name: j[k].name,
          price: parseFloat(j[k].price) || 0,
          prevClose: parseFloat(j[k].yestclose) || 0,
          open: parseFloat(j[k].open) || 0,
          change: parseFloat(j[k].change) || 0,
          changePercent: parseFloat(j[k].percent) || 0,
          high: parseFloat(j[k].high) || 0,
          low: parseFloat(j[k].low) || 0,
          updateTime: j[k].time || '',
          source: 'netease'
        }
      }
    }
  } catch (e) {}
  return null
}

async function fromSina(code: string): Promise<any | null> {
  try {
    const ex = getMarket(code)
    const url = `https://hq.sinajs.cn/list=${ex}${code}`
    const r = await fetchWithTimeout(url)
    const t = await r.text()
    const m = t.match(/var hq_str_[\w]+="([^"]+)"/)
    if (m) {
      const d = m[1].split(',')
      if (d.length >= 4) {
        const price = parseFloat(d[3]) || 0
        if (price > 0) {
          return {
            code,
            name: d[0],
            price,
            prevClose: parseFloat(d[2]) || 0,
            open: parseFloat(d[1]) || 0,
            change: price - (parseFloat(d[2]) || 0),
            changePercent: parseFloat(d[2]) > 0 ? ((price - parseFloat(d[2])) / parseFloat(d[2])) * 100 : 0,
            high: parseFloat(d[4]) || 0,
            low: parseFloat(d[5]) || 0,
            updateTime: d[d.length - 1] || '',
            source: 'sina'
          }
        }
      }
    }
  } catch (e) {}
  return null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = context.params.code as string
  if (!code || !/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ error: 'Invalid stock code, need 6 digits' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  // 多源并发，谁先成功用谁
  const results = await Promise.allSettled([
    fromEastMoney(code),
    fromTencent(code),
    fromNetEase(code),
    fromSina(code)
  ])

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.price > 0) {
      return new Response(JSON.stringify({ ok: true, data: r.value }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }
  }

  return new Response(JSON.stringify({ ok: false, error: 'All sources failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
