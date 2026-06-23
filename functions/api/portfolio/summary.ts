// GET /api/portfolio/summary
// 统一汇总接口：持仓明细 + 实时行情 + 动态计算指标
// 一次调用返回完整数据，前端所有 Tab 复用
// Header: Authorization: Bearer <email>

interface Env {
  DB: D1Database
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Cache-Control': 'no-cache'
}

function getEmail(request: Request): string | null {
  return (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim() || null
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

function isFinite(n: number): boolean {
  return typeof n === 'number' && !isNaN(n) && isFinite(n)
}

/**
 * 价格合理性校验
 */
function isValidPrice(price: number, prevClose: number): boolean {
  if (!isFinite(price) || price <= 0) return false
  if (price < 0.01 || price > 10000) return false
  if (isFinite(prevClose) && prevClose > 0) {
    if (Math.abs(price - prevClose) / prevClose > 0.3) return false
  }
  return true
}

function getMarket(code: string): 'sh' | 'sz' {
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'sh'
  return 'sz'
}

function formatTencentTime(s: string): string {
  if (!s || s.length !== 14) return ''
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)} ${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}`
}

/**
 * 东财价格（分→元）
 */
function fromFen(n: number): number { return (n || 0) / 100 }

/**
 * 从腾讯 qt.gtimg.cn 拉单个股票行情（GBK 编码）
 * 返回: { price, prevClose, open, change, changePercent, high, low, updateTime, name } | null
 */
async function fetchFromTencent(code: string): Promise<any | null> {
  try {
    const ex = getMarket(code)
    const url = `https://qt.gtimg.cn/q=${ex}${code}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://gu.qq.com/' }
    })
    if (!resp.ok) return null
    const buf = await resp.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buf)
    const m = text.match(/v_[\w]+="([^"]+)"/)
    if (!m) return null
    const d = m[1].split('~')
    if (d.length < 35) return null
    const price = parseFloat(d[3]) || 0
    const prevClose = parseFloat(d[4]) || 0
    if (!isValidPrice(price, prevClose)) return null
    return {
      price,
      prevClose,
      open: parseFloat(d[5]) || 0,
      change: parseFloat(d[31]) || (price - prevClose),
      changePercent: parseFloat(d[32]) || 0,
      high: parseFloat(d[33]) || 0,
      low: parseFloat(d[34]) || 0,
      updateTime: formatTencentTime(d[30] || ''),
      name: d[1] || ''
    }
  } catch { return null }
}

/**
 * 从东财 push2 拉单个股票行情（JSON，分单位价格）
 */
async function fetchFromEastMoney(code: string): Promise<any | null> {
  try {
    const ex = code.startsWith('6') || code.startsWith('5') || code.startsWith('9') ? '1' : '0'
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${ex}.${code}&fields=f43,f44,f45,f57,f58,f60,f92,f86`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/' }
    })
    if (!resp.ok) return null
    const j = await resp.json()
    if (!j.data) return null
    const price = fromFen(parseFloat(j.data.f43) || 0)
    const prevClose = fromFen(parseFloat(j.data.f60) || 0)
    if (!isValidPrice(price, prevClose)) return null
    let updateTime = ''
    const ts = parseFloat(j.data.f86)
    if (ts) {
      const d = new Date(ts > 1e12 ? ts : ts * 1000)
      if (!isNaN(d.getTime())) {
        updateTime = d.toLocaleString('zh-CN', { hour12: false })
      }
    }
    return {
      price,
      prevClose,
      open: prevClose,
      change: price - prevClose,
      changePercent: parseFloat(j.data.f92) || 0,
      high: fromFen(parseFloat(j.data.f44) || 0),
      low: fromFen(parseFloat(j.data.f45) || 0),
      updateTime,
      name: j.data.f58 || ''
    }
  } catch { return null }
}

/**
 * 批量拉取多个股票行情，并发请求，取最快返回的
 */
async function fetchPriceForCode(code: string): Promise<any | null> {
  const [t, e] = await Promise.allSettled([fetchFromTencent(code), fetchFromEastMoney(code)])
  if (t.status === 'fulfilled' && t.value) return t.value
  if (e.status === 'fulfilled' && e.value) return e.value
  return null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const email = getEmail(context.request)
  if (!email) return json({ ok: false, error: 'Unauthorized' }, 401)

  try {
    // Step 1: 从 D1 读取全部持仓
    const result = await context.env.DB.prepare(
      'SELECT data FROM holdings WHERE user_email = ? ORDER BY updated_at DESC'
    ).bind(email).all<{ data: string }>()

    const rawHoldings: any[] = result.results.map(r => {
      try { return JSON.parse(r.data) } catch { return null }
    }).filter(Boolean)

    if (rawHoldings.length === 0) {
      return json({
        ok: true,
        data: {
          holdings: [],
          summary: {
            totalMarketValue: 0,
            totalCost: 0,
            totalProfit: 0,
            totalProfitPercent: 0,
            stockCount: 0,
            fundCount: 0,
            updateTime: new Date().toISOString()
          },
          byType: {
            stock: { count: 0, marketValue: 0, cost: 0, profit: 0, profitPercent: 0, holdings: [] },
            fund: { count: 0, marketValue: 0, cost: 0, profit: 0, profitPercent: 0, holdings: [] }
          }
        }
      })
    }

    // Step 2: 收集所有股票代码
    const stockCodes = rawHoldings.filter(h => h.type === 'stock').map(h => h.symbol)
    const fundCodes = rawHoldings.filter(h => h.type === 'fund').map(h => h.symbol)

    // Step 3: 并发拉取股票行情（基金暂跳过，用成本价代替）
    const stockPrices = await Promise.all(
      stockCodes.map(async (code) => {
        const priceData = await fetchPriceForCode(code)
        return { code, priceData }
      })
    )
    const priceMap = new Map<string, any>()
    for (const { code, priceData } of stockPrices) {
      if (priceData) priceMap.set(code, priceData)
    }

    // Step 4: 计算每条持仓的动态指标
    const holdings = rawHoldings.map(h => {
      const priceData = priceMap.get(h.symbol) || {}
      const currentPrice = priceData.price || h.avgCost || 0
      const marketValue = (currentPrice || 0) * (h.quantity || 0)
      const cost = (h.avgCost || 0) * (h.quantity || 0)
      const profit = marketValue - cost
      const profitPercent = cost > 0 ? (profit / cost) * 100 : 0

      return {
        id: h.id,
        type: h.type,
        symbol: h.symbol,
        name: priceData.name || h.name || h.symbol,
        quantity: h.quantity || 0,
        avgCost: h.avgCost || 0,
        currentPrice,
        marketValue,
        cost,
        profit,
        profitPercent,
        changePercent: priceData.changePercent || 0,
        prevClose: priceData.prevClose || h.avgCost || 0,
        high: priceData.high || 0,
        low: priceData.low || 0,
        updateTime: priceData.updateTime || h.lastUpdated || '',
        lastUpdated: h.lastUpdated || ''
      }
    })

    // Step 5: 全局汇总
    const totalMarketValue = holdings.reduce((s, h) => s + h.marketValue, 0)
    const totalCost = holdings.reduce((s, h) => s + h.cost, 0)
    const totalProfit = totalMarketValue - totalCost
    const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
    const stockHoldings = holdings.filter(h => h.type === 'stock')
    const fundHoldings = holdings.filter(h => h.type === 'fund')

    // Step 6: 按类型汇总
    function typeSummary(list: typeof holdings) {
      const marketValue = list.reduce((s, h) => s + h.marketValue, 0)
      const cost = list.reduce((s, h) => s + h.cost, 0)
      const profit = marketValue - cost
      const profitPercent = cost > 0 ? (profit / cost) * 100 : 0
      return {
        count: list.length,
        marketValue,
        cost,
        profit,
        profitPercent
      }
    }

    const byType = {
      stock: {
        ...typeSummary(stockHoldings),
        holdings: stockHoldings
      },
      fund: {
        ...typeSummary(fundHoldings),
        holdings: fundHoldings
      }
    }

    return json({
      ok: true,
      data: {
        holdings,
        summary: {
          totalMarketValue,
          totalCost,
          totalProfit,
          totalProfitPercent,
          stockCount: stockHoldings.length,
          fundCount: fundHoldings.length,
          updateTime: new Date().toISOString()
        },
        byType
      }
    })
  } catch (e: any) {
    return json({ ok: false, error: e.message || 'Summary failed' }, 500)
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
