// GET /api/index/quotes
// 大盘指数实时行情代理：上证 / 深证 / 创业板

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'
import { fetchWithAntiCrawler } from '../../lib/anti-crawler'

interface Env {
  JWT_SECRET?: string
}

const INDEX_LIST = [
  { code: 'sh000001', name: '上证指数', short: '上证' },
  { code: 'sz399001', name: '深证成指', short: '深证' },
  { code: 'sz399006', name: '创业板指', short: '创业板' }
]

interface IndexQuote {
  code: string
  name: string
  short: string
  price: number
  change: number
  changePercent: number
  prevClose: number
  updateTime: string
  source?: string
}

function isValidPrice(price: number, prevClose: number): boolean {
  if (!isFinite(price) || price <= 0) return false
  if (price < 0.01 || price > 100000) return false
  if (isFinite(prevClose) && prevClose > 0) {
    const deviation = Math.abs(price - prevClose) / prevClose
    if (deviation > 0.3) return false
  }
  return true
}

async function fetchIndexFromSina(indexCode: string): Promise<IndexQuote | null> {
  try {
    const url = `https://hq.sinajs.cn/list=s_${indexCode}`
    const r = await fetchWithAntiCrawler(url, {}, 8000)
    const buf = await r.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buf)
    const match = text.match(/var hq_str_s_[\w]+="([^"]+)"/)
    if (!match) return null

    const data = match[1].split(',')
    if (data.length < 4) return null

    const price = parseFloat(data[3]) || 0
    const prevClose = parseFloat(data[2]) || 0

    if (!isValidPrice(price, prevClose)) return null

    return {
      code: indexCode,
      name: INDEX_LIST.find(i => i.code === indexCode)?.name || data[0] || indexCode,
      short: INDEX_LIST.find(i => i.code === indexCode)?.short || '',
      price,
      change: price - prevClose,
      changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      prevClose,
      updateTime: (data[30] && data[31]) ? `${data[30]} ${data[31]}` : '',
      source: 'sina-index'
    }
  } catch (e) {
    console.warn(`[index] 新浪 ${indexCode} 失败:`, (e as Error).message)
    return null
  }
}

async function fetchIndexFromEastMoney(indexCode: string): Promise<IndexQuote | null> {
  try {
    const numCode = indexCode.replace(/^[a-zA-Z]+/, '')
    const exchange = indexCode.startsWith('sh') ? '1' : '0'
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${exchange}.${numCode}&fields=f43,f44,f45,f57,f58,f60,f92,f86`
    const r = await fetchWithAntiCrawler(url, {}, 8000)
    const json = await r.json()
    if (!json?.data) return null

    const price = (parseFloat(json.data.f43) || 0) / 100
    const prevClose = (parseFloat(json.data.f60) || 0) / 100

    if (!isValidPrice(price, prevClose)) return null

    const meta = INDEX_LIST.find(i => i.code === indexCode)
    return {
      code: indexCode,
      name: meta?.name || json.data.f58 || indexCode,
      short: meta?.short || '',
      price,
      change: price - prevClose,
      changePercent: parseFloat(json.data.f92) || 0,
      prevClose,
      updateTime: json.data.f86
        ? new Date(parseFloat(json.data.f86) * (String(json.data.f86).length > 10 ? 1 : 1000))
            .toLocaleString('zh-CN', { hour12: false })
        : '',
      source: 'eastmoney-index'
    }
  } catch (e) {
    console.warn(`[index] 东财 ${indexCode} 失败:`, (e as Error).message)
    return null
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const results = await Promise.allSettled(
      INDEX_LIST.map(async (idx) => {
        const data = await fetchIndexFromSina(idx.code) || await fetchIndexFromEastMoney(idx.code)
        if (!data || !isFinite(data.price) || data.price <= 0) return null
        return data
      })
    )

    const quotes = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter((v): v is IndexQuote => v !== null)

    if (quotes.length === 0) {
      return jsonResponse({ ok: false, error: '大盘指数暂不可用' }, 503)
    }

    return jsonResponse({ ok: true, data: quotes })
  } catch (e: any) {
    console.error('[index/quotes] 错误:', e)
    return jsonResponse({ ok: false, error: e.message || '获取指数失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
