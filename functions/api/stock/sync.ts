interface Env {
  DB: D1Database
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function fetchWithTimeout(url: string, ms = 8000, referer = 'https://quote.eastmoney.com/'): Promise<Response> {
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

// 从东财拉取全量 A 股列表
async function fetchAllStocks(): Promise<any[]> {
  const results: any[] = []
  const pageSize = 500
  let page = 1
  let hasMore = true

  while (hasMore && page <= 20) {
    try {
      const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152`
      const r = await fetchWithTimeout(url, 8000, 'https://quote.eastmoney.com/')
      const j: any = await r.json()

      if (!j?.data?.diff || j.data.diff.length === 0) {
        hasMore = false
        break
      }

      for (const item of j.data.diff) {
        if (!item.f12 || !item.f14) continue
        results.push({
          code: String(item.f12),
          name: String(item.f14),
          price: item.f2 || 0,
          changePercent: item.f3 || 0,
          change: item.f4 || 0,
          volume: item.f5 || 0,
          turnover: item.f6 || 0,
          amplitude: item.f7 || 0,
          high: item.f15 || 0,
          low: item.f16 || 0,
          open: item.f17 || 0,
          prevClose: item.f18 || 0,
          pe: item.f9 || 0,
          pb: item.f23 || 0,
          totalMarketCap: item.f20 ? item.f20 / 100000000 : 0,
          circulatingMarketCap: item.f21 ? item.f21 / 100000000 : 0,
          turnoverRate: item.f8 || 0
        })
      }

      if (j.data.diff.length < pageSize) {
        hasMore = false
      }
      page++
    } catch (e) {
      console.error('[stock-sync] page', page, 'error:', (e as Error).message)
      hasMore = false
    }
  }

  return results
}

// 从东财获取行业和概念信息
async function fetchStockDetail(code: string, market: string): Promise<any> {
  try {
    const secid = `${market === 'SH' ? '1' : '0'}.${code}`
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58,f162,f163,f164,f165,f166,f167,f168,f169,f170`
    const r = await fetchWithTimeout(url, 3000)
    const j: any = await r.json()
    if (j?.data) {
      return {
        industry: j.data.f164 || '',
        industry2: j.data.f165 || '',
        concepts: j.data.f166 || '',
        listingDate: j.data.f163 ? String(j.data.f163) : '',
        totalShares: j.data.f167 ? j.data.f167 / 100000000 : 0,
        circulatingShares: j.data.f168 ? j.data.f168 / 100000000 : 0
      }
    }
  } catch (e) {
    // ignore
  }
  return {}
}

// 简易拼音首字母提取（从东财搜索接口拿不到拼音，用简单映射表）
function getPinyin(name: string): string {
  const map: Record<string, string> = {
    '贵': 'g', '州': 'z', '茅': 'm', '台': 't',
    '五': 'w', '粮': 'l', '液': 'y',
    '平': 'p', '安': 'a', '银': 'y', '行': 'h',
    '招': 'z', '商': 's',
    '中': 'z', '国': 'g',
    '海': 'h', '信': 'x', '证': 'z', '券': 'q',
    '比': 'b', '亚': 'y', '迪': 'd',
    '宁': 'n', '德': 'd', '时': 's', '代': 'd',
    '长': 'c', '江': 'j', '电': 'd', '力': 'l',
    '三': 's', '七': 'q', '互': 'h', '娱': 'y', '乐': 'l',
    '东': 'd', '方': 'f', '财': 'c', '富': 'f',
    '腾': 't', '讯': 'x', '科': 'k', '技': 'j',
    '阿': 'a', '里': 'l', '巴': 'b',
    '美': 'm', '的': 'd', '团': 't',
    '京': 'j', '东': 'd',
    '小': 'x', '米': 'm',
    '新': 'x', '能': 'n', '源': 'y',
    '汽': 'q', '车': 'c',
    '医': 'y', '药': 'y', '生': 's', '物': 'w',
    '股': 'g', '份': 'f', '有': 'y', '限': 'x', '公': 'g', '司': 's',
    '集': 'j', '团': 't',
    '上': 's', '海': 'h', '深': 's', '圳': 'z', '北': 'b', '京': 'j',
    '广': 'g', '州': 'z', '杭': 'h', '州': 'z',
  }
  let result = ''
  for (const ch of name) {
    result += map[ch] || ch.toLowerCase().charAt(0)
  }
  return result.toUpperCase().slice(0, 10)
}

function getMarket(code: string): string {
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'SH'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return 'SZ'
  return 'BJ'
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const mode = url.searchParams.get('mode') || 'full'
  const maxItems = parseInt(url.searchParams.get('limit') || '0', 10)

  try {
    // 先确保表存在
    await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS stock_basic (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pinyin TEXT,
      market TEXT NOT NULL,
      industry TEXT,
      industry2 TEXT,
      concepts TEXT,
      listing_date TEXT,
      total_shares REAL,
      circulating_shares REAL,
      pe REAL,
      pb REAL,
      total_market_cap REAL,
      circulating_market_cap REAL,
      updated_at TEXT NOT NULL
    )`).run()

    const allStocks = await fetchAllStocks()
    if (allStocks.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: '未获取到股票数据' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const toInsert = maxItems > 0 ? allStocks.slice(0, maxItems) : allStocks
    const now = new Date().toISOString()
    let successCount = 0
    let failCount = 0

    // 分批插入，每次 50 条
    const batchSize = 50
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize)
      const stmt = context.env.DB.prepare(`INSERT OR REPLACE INTO stock_basic 
        (code, name, pinyin, market, industry, industry2, concepts, listing_date, 
         total_shares, circulating_shares, pe, pb, total_market_cap, circulating_market_cap, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`)

      for (const stock of batch) {
        try {
          const market = getMarket(stock.code)
          const pinyin = getPinyin(stock.name)
          await stmt.bind(
            stock.code, stock.name, pinyin, market,
            null, null, null, null,
            null, null,
            stock.pe || null, stock.pb || null,
            stock.totalMarketCap || null, stock.circulatingMarketCap || null,
            now
          ).run()
          successCount++
        } catch (e) {
          failCount++
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      total: allStocks.length,
      inserted: successCount,
      failed: failCount,
      mode
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
