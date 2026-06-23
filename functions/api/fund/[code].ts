// Cloudflare Pages Function: 基金净值代理
// 路径: /api/fund/:code

interface Env {}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60'
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = context.params.code as string
  if (!code || !/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ error: 'Invalid fund code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fund.eastmoney.com/'
      }
    })
    const t = await r.text()
    const m = t.match(/var\s+pgz\s*=\s*({[\s\S]*});/)
    if (m) {
      const d = JSON.parse(m[1])
      const nav = parseFloat(d.dwjz) || 0
      const prevNav = parseFloat(d.yestdwjz) || 0
      return new Response(JSON.stringify({
        ok: true,
        data: {
          code: d.fundCode,
          name: d.fundName,
          nav,
          prevNav,
          change: nav - prevNav,
          changePercent: parseFloat(d.gszzl) || 0,
          updateTime: d.jzrq || '',
          source: 'eastmoney-fund'
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }
  } catch (e) {
    // fall through
  }

  return new Response(JSON.stringify({ ok: false, error: 'Fund not found' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
