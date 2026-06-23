export interface StockData {
  code: string
  name: string
  price: number
  prevClose: number
  open: number
  change: number
  changePercent: number
  high?: number
  low?: number
  updateTime: string
  source?: string
}

export interface FundData {
  code: string
  name: string
  nav: number
  prevNav: number
  change: number
  changePercent: number
  updateTime: string
  source?: string
}

export interface StockSearchResult {
  code: string
  name: string
  pinyin?: string
  market?: string   // 'SH' | 'SZ' | 'BJ'
  securityType?: string
}

// =================== API 入口判断 ===================
// 生产部署在 Cloudflare Pages 时，/api/* 是同源代理（无 CORS）
// 本地开发时（localhost:5173）没有 /api，会自动回退到直接 fetch
const isProdPages = typeof window !== 'undefined' && /pages\.dev$/.test(window.location.hostname)
const API_BASE = isProdPages ? '/api' : '/api'  // 同源调用，统一走 /api

// 本地 dev 模式下 /api/* 走 Vite 代理（如配置了）或 fallback
// 这里我们做一个简单的特性：prod 强制 /api，dev 直接调用第三方（避免本地启动 wrangler 复杂）

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

/**
 * 价格合理性校验
 * - 必须 > 0
 * - 0.01 ~ 10000 元
 * - 与昨收偏差不超过 30%（防单源异常数据）
 */
export function isValidPrice(price: number, prevClose?: number): boolean {
  if (!isFinite(price) || price <= 0) return false
  if (price < 0.01 || price > 10000) return false
  if (prevClose !== undefined && isFinite(prevClose) && prevClose > 0) {
    const deviation = Math.abs(price - prevClose) / prevClose
    if (deviation > 0.3) return false
  }
  return true
}

async function fetchStockFromEastMoney(code: string): Promise<StockData | null> {
  try {
    const exchange = getExchangeCode(code)
    // ⚠️ f43/f44/f45/f60 是「分」单位（×100），f116/f117 是市值（不是昨收/今开）
    // f86=时间戳(秒) f57=代码 f58=名称
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${exchange}.${code}&fields=f43,f44,f45,f57,f58,f60,f92,f86`
    const response = await fetchWithTimeout(url, 5000, { referrerPolicy: 'no-referrer' })
    const data = await response.json()
    if (data.data) {
      const price = (parseFloat(data.data.f43) || 0) / 100
      const prevClose = (parseFloat(data.data.f60) || 0) / 100
      if (isValidPrice(price, prevClose)) {
        return {
          code: data.data.f57 || code,
          name: data.data.f58 || '',
          price,
          prevClose,
          open: prevClose, // f60=昨收，今开需要 f152 字段
          change: price - prevClose,
          changePercent: parseFloat(data.data.f92) || 0,
          high: (parseFloat(data.data.f44) || 0) / 100,
          low: (parseFloat(data.data.f45) || 0) / 100,
          updateTime: formatEastTime(data.data.f86),
          source: 'eastmoney'
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 东财时间戳（秒） -> 可读字符串
 */
function formatEastTime(ts: string | number | undefined): string {
  if (!ts) return ''
  const n = parseFloat(String(ts))
  if (!isFinite(n) || n <= 0) return ''
  const ms = n > 1e12 ? n : n * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', { hour12: false })
}

async function fetchStockFromSina(code: string): Promise<StockData | null> {
  try {
    const exchange = getMarket(code).toLowerCase()
    // 新浪返回 GBK 编码，需要 arrayBuffer + TextDecoder
    const url = `https://hq.sinajs.cn/list=${exchange}${code}`
    const response = await fetchWithTimeout(url, 5000, { referrerPolicy: 'no-referrer' })
    const buf = await response.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buf)
    const match = text.match(/var hq_str_[\w]+="([^"]+)"/)
    if (match) {
      const data = match[1].split(',')
      if (data.length >= 32) {
        const price = parseFloat(data[3]) || 0
        const prevClose = parseFloat(data[2]) || 0
        const open = parseFloat(data[1]) || 0
        if (isValidPrice(price, prevClose)) {
          return {
            code,
            name: data[0] || '',
            price,
            prevClose,
            open,
            change: price - prevClose,
            changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
            high: parseFloat(data[4]) || 0,
            low: parseFloat(data[5]) || 0,
            // 新浪 d[30]=日期 d[31]=时间，d[length-1] 是别的字段
            updateTime: (data[30] && data[31]) ? `${data[30]} ${data[31]}` : '',
            source: 'sina'
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
    // 腾讯返回 GBK 编码
    const url = `https://qt.gtimg.cn/q=${exchange}${code}`
    const response = await fetchWithTimeout(url, 5000, { referrerPolicy: 'no-referrer' })
    const buf = await response.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buf)
    const match = text.match(/v_[\w]+="([^"]+)"/)
    if (match) {
      const data = match[1].split('~')
      if (data.length >= 35) {
        const price = parseFloat(data[3]) || 0
        const prevClose = parseFloat(data[4]) || 0
        if (isValidPrice(price, prevClose)) {
          // 腾讯 d[30] 形如 "20260623142843"
          let updateTime = ''
          if (data[30] && /^\d{14}$/.test(data[30])) {
            const s = data[30]
            updateTime = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`
          }
          return {
            code,
            name: data[1] || '',
            price,
            prevClose,
            open: parseFloat(data[5]) || 0,
            change: parseFloat(data[31]) || (price - prevClose),
            changePercent: parseFloat(data[32]) || 0,
            high: parseFloat(data[33]) || 0,
            low: parseFloat(data[34]) || 0,
            updateTime,
            source: 'tencent'
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
 * 拉取单个股票当前价：
 *   1) 优先调用同源 /api/stock/:code 代理（Cloudflare Pages Functions，无 CORS）
 *   2) 失败时降级到直接调用第三方 API（开发模式或代理异常时）
 */
export async function fetchStockPrice(code: string): Promise<StockData | null> {
  // 方式 1：同源代理（生产推荐，无 CORS）
  try {
    const resp = await fetchWithTimeout(`${API_BASE}/stock/${code}`, 6000)
    if (resp.ok) {
      const j: any = await resp.json()
      if (j?.ok && j.data && j.data.price > 0 && isValidPrice(j.data.price, j.data.prevClose)) {
        return j.data as StockData
      }
    }
  } catch (e) {
    console.warn(`[proxy] 股票 ${code} 代理失败:`, (e as any)?.message || e)
  }

  // 方式 2：直接调用第三方（fallback）
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
      if (result && result.price > 0 && isValidPrice(result.price, result.prevClose)) {
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
 * 并发拉取所有持仓当前价
 * 生产走 /api 代理；开发走直连
 */
export async function fetchBatchPrices(
  holdings: Array<{ type: 'stock' | 'fund'; symbol: string }>
): Promise<{ prices: Map<string, { price: number; name?: string; source?: string; prevClose?: number }>; successCount: number; totalCount: number }> {
  const priceMap = new Map<string, { price: number; name?: string; source?: string; prevClose?: number }>()
  let successCount = 0

  // 1) 优先走同源批量代理（如有），否则并发单标的调用
  const stockTasks = holdings.filter(h => h.type === 'stock')
  const fundTasks = holdings.filter(h => h.type === 'fund')

  // 尝试调用批量代理（如果后端支持）；失败则并发单标的
  try {
    if (stockTasks.length > 0) {
      // 简单实现：并发调用单标的代理
      const stockResults = await Promise.allSettled(
        stockTasks.map(async h => {
          try {
            const r = await fetchWithTimeout(`${API_BASE}/stock/${h.symbol}`, 6000)
            if (r.ok) {
              const j: any = await r.json()
              if (j?.ok && j.data) return { symbol: h.symbol, data: j.data }
            }
            return { symbol: h.symbol, data: null }
          } catch {
            return { symbol: h.symbol, data: null }
          }
        })
      )
      for (const r of stockResults) {
        if (r.status === 'fulfilled' && r.value.data && r.value.data.price > 0 && isValidPrice(r.value.data.price, r.value.data.prevClose)) {
          priceMap.set(r.value.symbol, { price: r.value.data.price, name: r.value.data.name, source: r.value.data.source })
          successCount++
        }
      }
    }
  } catch (e) {
    console.warn('批量股票代理异常:', e)
  }

  // 基金
  for (const h of fundTasks) {
    try {
      // 先尝试代理
      const r = await fetchWithTimeout(`${API_BASE}/fund/${h.symbol}`, 6000)
      if (r.ok) {
        const j: any = await r.json()
        if (j?.ok && j.data) {
          priceMap.set(h.symbol, { price: j.data.nav, name: j.data.name, source: j.data.source, prevClose: j.data.prevNav })
          successCount++
          continue
        }
      }
    } catch {}
    // fallback
    try {
      const data = await fetchFundNavDirect(h.symbol)
      if (data && data.nav > 0) {
        priceMap.set(h.symbol, { price: data.nav, name: data.name })
        successCount++
      }
    } catch (e) {
      console.error(`获取基金 ${h.symbol} 净值失败:`, e)
    }
  }

  // 如果代理完全失败，fallback 到直接 fetch
  if (priceMap.size === 0 && holdings.length > 0) {
    console.warn('代理全部失败，降级到直连第三方 API')
    for (const h of stockTasks) {
      try {
        const data = await fetchStockPrice(h.symbol)
        if (data && data.price > 0 && isValidPrice(data.price, data.prevClose)) {
          priceMap.set(h.symbol, { price: data.price, name: data.name, prevClose: data.prevClose })
          successCount++
        }
      } catch (e) {
        console.error(`直接获取 ${h.symbol} 失败:`, e)
      }
    }
  }

  return { prices: priceMap, successCount, totalCount: holdings.length }
}

// 直接调用东财的基金接口（fallback）
async function fetchFundNavDirect(code: string): Promise<FundData | null> {
  return fetchFundNav(code)
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
 * 股票/基金搜索：优先调用同源 /api/search 代理
 * 失败时降级到内置字典
 */
export async function searchSecurities(keyword: string, type: 'stock' | 'fund' = 'stock'): Promise<StockSearchResult[]> {
  if (!keyword || keyword.trim().length === 0) return []
  const kw = keyword.trim()

  // 1) 同源代理
  try {
    const r = await fetchWithTimeout(`${API_BASE}/search?q=${encodeURIComponent(kw)}&type=${type}`, 4000)
    if (r.ok) {
      const j: any = await r.json()
      if (j?.ok && Array.isArray(j.data) && j.data.length > 0) {
        return j.data
      }
    }
  } catch (e) {
    console.warn('搜索代理失败:', e)
  }

  // 2) Fallback：直接调东财（可能有 CORS）
  try {
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

  // 3) 本地字典兜底
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
