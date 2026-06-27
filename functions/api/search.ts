interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60'
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function searchFromD1(db: D1Database, q: string, type: string): Promise<any[] | null> {
  try {
    const table = type === 'fund' ? 'fund_basic' : 'stock_basic'

    const { results } = await db.prepare(`SELECT code, name, pinyin, market, industry
      FROM ${table}
      WHERE code LIKE ?1 OR name LIKE ?2 OR pinyin LIKE ?3
      ORDER BY CASE
        WHEN code = ?1 THEN 0
        WHEN name = ?2 THEN 1
        WHEN code LIKE ?1 THEN 2
        WHEN name LIKE ?2 THEN 3
        ELSE 4
      END
      LIMIT 20`).bind(`${q}%`, `%${q}%`, `${q.toUpperCase()}%`).all()

    if (results && results.length > 0) {
      return results.map((r: any) => ({
        code: r.code,
        name: r.name,
        pinyin: r.pinyin,
        market: r.market,
        industry: r.industry,
        securityType: type === 'fund' ? '基金' : '股票'
      }))
    }
  } catch (e) {
    console.warn('[search] D1 搜索失败:', (e as Error).message)
  }
  return null
}

async function searchFromEastMoney(q: string, type: string): Promise<any[]> {
  try {
    const apiType = type === 'fund' ? '22' : '14'
    const r = await fetch(
      `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=${apiType}&count=20&token=D43BF722C8E33BDC906FB84D85E326E8`,
      {
        headers: {
          'User-Agent': UA,
          'Referer': 'https://www.eastmoney.com/'
        }
      }
    )
    const j: any = await r.json()
    if (j?.QuotationCodeTable?.Data) {
      return j.QuotationCodeTable.Data.map((it: any) => ({
        code: it.Code,
        name: it.Name,
        pinyin: it.PinYin,
        market: it.MktNum === '1' ? 'SH' : it.MktNum === '0' ? 'SZ' : 'BJ',
        securityType: it.SecurityTypeName
      }))
    }
  } catch (e) {
    // ignore
  }
  return []
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const q = url.searchParams.get('q') || ''
  const type = url.searchParams.get('type') || 'stock'

  if (!q.trim()) {
    return new Response(JSON.stringify({ ok: true, data: [], source: 'empty' }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  const db = context.env.DB

  // 先试 D1
  const d1Results = await searchFromD1(db, q.trim(), type)
  if (d1Results && d1Results.length > 0) {
    return new Response(JSON.stringify({ ok: true, data: d1Results, source: 'd1' }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  // D1 没数据，fallback 到东财
  const externalResults = await searchFromEastMoney(q.trim(), type)
  return new Response(JSON.stringify({ ok: true, data: externalResults, source: 'eastmoney' }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
