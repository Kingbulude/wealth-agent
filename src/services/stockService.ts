export interface StockData {
  code: string
  name: string
  price: number
  prevClose: number
  open: number
  change: number
  changePercent: number
  updateTime: string
}

export interface FundData {
  code: string
  name: string
  nav: number
  prevNav: number
  change: number
  changePercent: number
  updateTime: string
}

export interface StockSearchResult {
  code: string
  name: string
  pinyin?: string
  market?: string   // 'SH' | 'SZ' | 'BJ'
  securityType?: string
}

function getExchangeCode(code: string): string {
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return '1'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return '0'
  if (code.startsWith('4') || code.startsWith('8')) return '8'
  return '1'
}

function getMarket(code: string): 'SH' | 'SZ' | 'BJ' {
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'SH'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return 'SZ'
  return 'BJ'
}

function getYahooCode(code: string): string {
  if (code.startsWith('6')) return `${code}.SS`
  if (code.startsWith('0') || code.startsWith('3')) return `${code}.SZ`
  return `${code}.SS`
}

async function fetchWithTimeout(url: string, timeout: number = 5000, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

export function isValidPrice(price: number): boolean {
  return price > 0 && price <= 10000
}

async function fetchStockFromEastMoney(code: string): Promise<StockData | null> {
  try {
    const exchange = getExchangeCode(code)
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${exchange}.${code}&fields=f57,f58,f116,f117,f43,f44,f92,f175`
    const response = await fetchWithTimeout(url, 5000, { referrerPolicy: 'no-referrer' })
    const data = await response.json()
    if (data.data) {
      const price = parseFloat(data.data.f43) || 0
      if (isValidPrice(price)) {
        return {
          code: data.data.f57,
          name: data.data.f58,
          price,
          prevClose: parseFloat(data.data.f116) || 0,
          open: parseFloat(data.data.f117) || 0,
          change: parseFloat(data.data.f44) || 0,
          changePercent: parseFloat(data.data.f92) || 0,
          updateTime: data.data.f175 || ''
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchStockFromSina(code: string): Promise<StockData | null> {
  try {
    const exchange = getMarket(code).toLowerCase()
    const url = `https://hq.sinajs.cn/list=${exchange}${code}`
    const response = await fetchWithTimeout(url, 5000, { referrerPolicy: 'no-referrer' })
    const text = await response.text()
    const match = text.match(/var hq_str_[\w]+="([^"]+)"/)
    if (match) {
      const data = match[1].split(',')
      if (data.length >= 4) {
        const price = parseFloat(data[3]) || 0
        const prevClose = parseFloat(data[2]) || 0
        const open = parseFloat(data[1]) || 0
        if (price > 0 && isValidPrice(price)) {
          return {
            code,
            name: data[0],
            price,
            prevClose,
            open,
            change: price - prevClose,
            changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
            updateTime: data[data.length - 1] || ''
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchStockFromYahoo(code: string): Promise<StockData | null> {
  try {
    const yahooCode = getYahooCode(code)
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooCode}`
    const response = await fetchWithTimeout(url, 5000)
    const data = await response.json()
    if (data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result.length > 0) {
      const item = data.quoteResponse.result[0]
      const price = item.regularMarketPrice || 0
      const prevClose = item.regularMarketPreviousClose || 0
      if (price > 0 && isValidPrice(price)) {
        return {
          code,
          name: item.shortName || item.longName || code,
          price,
          prevClose,
          open: item.regularMarketOpen || 0,
          change: item.regularMarketChange || (price - prevClose),
          changePercent: item.regularMarketChangePercent || (prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0),
          updateTime: item.regularMarketTime ? new Date(item.regularMarketTime * 1000).toLocaleString() : ''
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchStockFromNetEase(code: string): Promise<StockData | null> {
  try {
    const exchange = code.startsWith('6') ? '0' : '1'
    const url = `https://api.money.126.net/data/feed/${exchange}${code},money.api`
    const response = await fetchWithTimeout(url, 5000)
    const text = await response.text()
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const data = JSON.parse(match[0])
      const key = `${exchange}${code}`
      if (data[key]) {
        const price = parseFloat(data[key].price) || 0
        if (price > 0 && isValidPrice(price)) {
          return {
            code,
            name: data[key].name || '',
            price,
            prevClose: parseFloat(data[key].yestclose) || 0,
            open: parseFloat(data[key].open) || 0,
            change: parseFloat(data[key].change) || 0,
            changePercent: parseFloat(data[key].percent) || 0,
            updateTime: data[key].time || ''
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchStockFromTencent(code: string): Promise<StockData | null> {
  try {
    const exchange = getMarket(code).toLowerCase()
    const url = `https://qt.gtimg.cn/q=${exchange}${code}`
    const response = await fetchWithTimeout(url, 5000, { referrerPolicy: 'no-referrer' })
    const text = await response.text()
    const match = text.match(/v_[\w]+="([^"]+)"/)
    if (match) {
      const data = match[1].split('~')
      if (data.length >= 6) {
        const price = parseFloat(data[3]) || 0
        if (price > 0 && isValidPrice(price)) {
          return {
            code,
            name: data[1],
            price,
            prevClose: parseFloat(data[4]) || 0,
            open: parseFloat(data[5]) || 0,
            change: parseFloat(data[31]) || (price - parseFloat(data[4]) || 0),
            changePercent: parseFloat(data[32]) || 0,
            updateTime: data[data.length - 1] || ''
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 拉取单个股票当前价，按优先级尝试多个数据源
 */
export async function fetchStockPrice(code: string): Promise<StockData | null> {
  const sources = [
    { name: 'eastmoney', fn: () => fetchStockFromEastMoney(code) },
    { name: 'tencent', fn: () => fetchStockFromTencent(code) },
    { name: 'netease', fn: () => fetchStockFromNetEase(code) },
    { name: 'sina', fn: () => fetchStockFromSina(code) },
    { name: 'yahoo', fn: () => fetchStockFromYahoo(code) }
  ]
  for (const { name, fn } of sources) {
    try {
      const result = await fn()
      if (result && result.price > 0 && isValidPrice(result.price)) {
        console.debug(`[${name}] 股票 ${code} 价格: ¥${result.price}`)
        return result
      }
    } catch (e: any) {
      console.warn(`[${name}] API 失败:`, e?.message || e)
    }
  }
  return null
}

/**
 * 并发拉取所有持仓当前价，提升刷新速度
 */
export async function fetchBatchPrices(
  holdings: Array<{ type: 'stock' | 'fund'; symbol: string }>
): Promise<{ prices: Map<string, { price: number; name?: string }>; successCount: number; totalCount: number }> {
  const priceMap = new Map<string, { price: number; name?: string }>()
  let successCount = 0

  // 基金用单独函数；股票并发
  const stockTasks = holdings.filter(h => h.type === 'stock')
  const fundTasks = holdings.filter(h => h.type === 'fund')

  const stockResults = await Promise.allSettled(
    stockTasks.map(async h => ({ symbol: h.symbol, data: await fetchStockPrice(h.symbol) }))
  )
  for (const r of stockResults) {
    if (r.status === 'fulfilled' && r.value.data && isValidPrice(r.value.data.price)) {
      priceMap.set(r.value.symbol, { price: r.value.data.price, name: r.value.data.name })
      successCount++
    }
  }

  for (const h of fundTasks) {
    try {
      const data = await fetchFundNav(h.symbol)
      if (data && data.nav > 0) {
        priceMap.set(h.symbol, { price: data.nav, name: data.name })
        successCount++
      }
    } catch (e) {
      console.error(`获取基金 ${h.symbol} 净值失败:`, e)
    }
  }

  return { prices: priceMap, successCount, totalCount: holdings.length }
}

export async function fetchFundNav(code: string): Promise<FundData | null> {
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`
    const response = await fetchWithTimeout(url, 6000, { referrerPolicy: 'no-referrer' })
    const text = await response.text()
    const match = text.match(/var\s+pgz\s*=\s*({[\s\S]*});/)
    if (match) {
      const data = JSON.parse(match[1])
      return {
        code: data.fundCode,
        name: data.fundName,
        nav: parseFloat(data.dwjz) || 0,
        prevNav: parseFloat(data.yestdwjz) || 0,
        change: (parseFloat(data.dwjz) || 0) - (parseFloat(data.yestdwjz) || 0),
        changePercent: parseFloat(data.gszzl) || 0,
        updateTime: data.jzrq || ''
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 股票/基金搜索：调用东财搜索 API（支持代码、中文名、拼音首字母）
 * 失败时降级到内置字典
 */
export async function searchSecurities(keyword: string, type: 'stock' | 'fund' = 'stock'): Promise<StockSearchResult[]> {
  if (!keyword || keyword.trim().length === 0) return []
  const kw = keyword.trim()

  try {
    // 东财搜索：type=14 股票，type=22 基金
    const apiType = type === 'stock' ? '14' : '22'
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(kw)}&type=${apiType}&count=20&token=D43BF722C8E33BDC906FB84D85E326E8`
    const response = await fetchWithTimeout(url, 4000)
    const json = await response.json()
    if (json?.QuotationCodeTable?.Data && Array.isArray(json.QuotationCodeTable.Data)) {
      return json.QuotationCodeTable.Data.map((it: any) => ({
        code: it.Code,
        name: it.Name,
        pinyin: it.PinYin,
        market: it.MktNum === '1' ? 'SH' : it.MktNum === '0' ? 'SZ' : 'BJ',
        securityType: it.SecurityTypeName
      }))
    }
  } catch (e) {
    console.warn('东财搜索 API 失败，本地降级:', e)
  }

  // 降级：用本地字典做模糊匹配
  return localSearchFallback(kw, type)
}

import { STOCK_LIST, FUND_LIST } from './securityDict'

function localSearchFallback(keyword: string, type: 'stock' | 'fund'): StockSearchResult[] {
  const list = type === 'stock' ? STOCK_LIST : FUND_LIST
  const lower = keyword.toLowerCase()
  return list
    .filter(item =>
      item.code.includes(keyword) ||
      item.name.toLowerCase().includes(lower) ||
      (item.pinyin && item.pinyin.toLowerCase().includes(lower)) ||
      // 缩写匹配：取每个汉字首字母
      (item.py && item.py.toLowerCase().startsWith(lower))
    )
    .slice(0, 20)
}
