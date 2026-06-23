// Cloudflare Pages Function: 股票/基金搜索代理
// 路径: /api/search?q=xxx&type=stock|fund

interface Env {}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300'
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const q = url.searchParams.get('q') || ''
  const type = url.searchParams.get('type') || 'stock'

  if (!q.trim()) {
    return new Response(JSON.stringify({ ok: true, data: [] }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  // type=14 股票，type=22 基金
  const apiType = type === 'fund' ? '22' : '14'

  try {
    const r = await fetch(
      `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=${apiType}&count=20&token=D43BF722C8E33BDC906FB84D85E326E8`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.eastmoney.com/'
        }
      }
    )
    const j: any = await r.json()
    if (j?.QuotationCodeTable?.Data) {
      const data = j.QuotationCodeTable.Data.map((it: any) => ({
        code: it.Code,
        name: it.Name,
        pinyin: it.PinYin,
        market: it.MktNum === '1' ? 'SH' : it.MktNum === '0' ? 'SZ' : 'BJ',
        securityType: it.SecurityTypeName
      }))
      return new Response(JSON.stringify({ ok: true, data }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }
  } catch (e) {
    // ignore
  }

  return new Response(JSON.stringify({ ok: true, data: [] }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
