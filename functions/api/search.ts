import { fetchWithAntiCrawler } from '../lib/anti-crawler'

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60'
}

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
  if (type === 'fund') {
    try {
      const r = await fetchWithAntiCrawler(
        `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=22&count=20&token=D43BF722C8E33BDC906FB84D85E326E8`,
        {}, 6000
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

  // 股票搜索：尝试多个源
  const sources = [
    async () => {
      const r = await fetchWithAntiCrawler(
        `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&count=20&token=D43BF722C8E33BDC906FB84D85E326E8`,
        {}, 6000
      )
      const j: any = await r.json()
      if (j?.QuotationCodeTable?.Data?.length > 0) {
        return j.QuotationCodeTable.Data.map((it: any) => ({
          code: it.Code,
          name: it.Name,
          pinyin: it.PinYin,
          market: it.MktNum === '1' ? 'SH' : it.MktNum === '0' ? 'SZ' : 'BJ',
          securityType: it.SecurityTypeName
        }))
      }
      return null
    },
    async () => {
      const r = await fetchWithAntiCrawler(
        `https://suggest3.sinajs.cn/suggest/type=111&key=${encodeURIComponent(q)}`,
        {}, 6000
      )
      const text = await r.text()
      const m = text.match(/\{[\s\S]*\}/)
      if (m) {
        const j = JSON.parse(m[0])
        if (j.result?.length > 0) {
          return j.result
            .filter((it: any) => it.type === 'stock' || it.type === '11')
            .map((it: any) => ({
              code: it.code || '',
              name: it.name || '',
              pinyin: '',
              market: it.code?.startsWith('6') ? 'SH' : 'SZ',
              securityType: '股票'
            }))
            .filter((it: any) => it.code && it.name)
        }
      }
      return null
    },
    async () => {
      if (/^\d{6}$/.test(q)) {
        const market = q.startsWith('6') ? 'sh' : 'sz'
        const r = await fetchWithAntiCrawler(
          `https://qt.gtimg.cn/q=${market}${q}`,
          {}, 5000
        )
        const buf = await r.arrayBuffer()
        const text = new TextDecoder('gbk').decode(buf)
        const m = text.match(/v_[\w]+="([^"]+)"/)
        if (m) {
          const d = m[1].split('~')
          if (d.length >= 3 && d[1] && d[2]) {
            return [{
              code: d[2],
              name: d[1],
              pinyin: '',
              market: d[2]?.startsWith('6') ? 'SH' : 'SZ',
              securityType: '股票'
            }]
          }
        }
      }
      return null
    },
    async () => {
      const r = await fetchWithAntiCrawler(
        `https://www.10jqka.com.cn/api/search/stock/?keyword=${encodeURIComponent(q)}`,
        {}, 6000
      )
      const j: any = await r.json()
      if (j?.data?.list?.length > 0) {
        return j.data.list.map((it: any) => ({
          code: it.code || '',
          name: it.name || '',
          pinyin: '',
          market: it.code?.startsWith('6') ? 'SH' : 'SZ',
          securityType: '股票'
        })).filter((it: any) => it.code && it.name)
      }
      return null
    },
    async () => {
      const r = await fetchWithAntiCrawler(
        `https://xueqiu.com/stock/search.json?code=${encodeURIComponent(q)}&size=10&page=1`,
        {}, 6000
      )
      const j: any = await r.json()
      if (j?.stocks?.length > 0) {
        return j.stocks.map((it: any) => ({
          code: it.code?.replace(/^[a-zA-Z]+/, '') || '',
          name: it.name || '',
          pinyin: '',
          market: it.code?.startsWith('SH') ? 'SH' : it.code?.startsWith('SZ') ? 'SZ' : 'BJ',
          securityType: '股票'
        })).filter((it: any) => it.code && it.name)
      }
      return null
    }
  ]

  for (const fn of sources) {
    try {
      const result = await fn()
      if (result && result.length > 0) {
        return result
      }
    } catch (e) {
      // continue to next source
    }
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
