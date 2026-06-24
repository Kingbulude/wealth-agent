// Cloudflare Pages Function: 基金净值代理
// 路径: /api/fund/:code

interface Env {}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60'
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

/**
 * 天天基金实时估值（盘中实时更新，优先用）
 */
async function fromTiantian(code: string): Promise<any | null> {
  try {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Referer': 'https://fund.eastmoney.com/' }
    })
    const t = await r.text()
    const m = t.match(/jsonpgz\(([\s\S]*)\);/)
    if (m) {
      const d = JSON.parse(m[1])
      const gsz = parseFloat(d.gsz) || 0
      const dwjz = parseFloat(d.dwjz) || 0
      const gszzl = parseFloat(d.gszzl) || 0
      if (gsz > 0 && dwjz > 0) {
        return {
          code: d.fundcode || code,
          name: d.name || '',
          nav: gsz,
          prevNav: dwjz,
          change: gsz - dwjz,
          changePercent: gszzl,
          updateTime: d.gztime || '',
          source: 'tiantian'
        }
      }
    }
  } catch {
    // fall through
  }
  return null
}

/**
 * 东财平中数据（历史净值，非实时）
 */
async function fromEastMoney(code: string): Promise<any | null> {
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Referer': 'https://fund.eastmoney.com/' }
    })
    const t = await r.text()
    const m = t.match(/var\s+pgz\s*=\s*({[\s\S]*});/)
    if (m) {
      const d = JSON.parse(m[1])
      const nav = parseFloat(d.dwjz) || 0
      const prevNav = parseFloat(d.yestdwjz) || 0
      return {
        code: d.fundCode,
        name: d.fundName,
        nav,
        prevNav,
        change: nav - prevNav,
        changePercent: parseFloat(d.gszzl) || 0,
        updateTime: d.jzrq || '',
        source: 'eastmoney-fund'
      }
    }
  } catch {
    // fall through
  }
  return null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = context.params.code as string
  if (!code || !/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ error: 'Invalid fund code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  // 多源并发：天天基金（实时估值） + 东财（净值兜底）
  const [ttRes, emRes] = await Promise.allSettled([
    fromTiantian(code),
    fromEastMoney(code)
  ])

  const data = (ttRes.status === 'fulfilled' && ttRes.value) ||
    (emRes.status === 'fulfilled' && emRes.value)

  if (data) {
    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  return new Response(JSON.stringify({ ok: false, error: 'Fund not found' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
