// 共享的股票数据获取与 AI 分析上下文构建
// 抽取自 stock-analysis.ts 和 stock-analysis-stream.ts，避免代码重复

import { fetchWithAntiCrawler } from './anti-crawler'

export interface GatheredData {
  indices: any[] | null
  stock: any | null
  quote: any | null
  company: any | null
  financial: any | null
  news: any[] | null
  peers: any[] | null
}

export function getMarket(code: string): 'sh' | 'sz' | 'bj' | 'hk' {
  if (/^\d{5}$/.test(code)) return 'hk'
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'sh'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return 'sz'
  return 'bj'
}

export function isValidPrice(price: number, prevClose: number): boolean {
  if (!isFinite(price) || price <= 0) return false
  if (price < 0.01 || price > 10000) return false
  if (isFinite(prevClose) && prevClose > 0) {
    const deviation = Math.abs(price - prevClose) / prevClose
    if (deviation > 0.3) return false
  }
  return true
}

export function extractStockKeyword(query: string): string | null {
  const codeMatch = query.match(/\b[0-9]{6}\b/)
  if (codeMatch) return codeMatch[0]
  const prefixedMatch = query.match(/(sh|sz|bj)[0-9]{6}/i)
  if (prefixedMatch) return prefixedMatch[0].replace(/^(sh|sz|bj)/i, '')
  const stopWords = ['分析', '诊断', '评估', '研究', '看看', '说说', '推荐', '买入', '卖出',
    '怎么样', '如何', '什么', '能不能', '可以', '会', '吗', '呢',
    '今天', '明天', '最近', '现在', '目前', '股票', '个股', '标的',
    '这个', '那个', '持仓', '仓位', '行情', '走势', '深度', '一下']
  let cleaned = query.replace(new RegExp(stopWords.join('|'), 'gi'), ' ')
    .replace(/[，。？！,.!?、；：""''（）\(\)\s\d\-_/\\|]+/g, ' ').trim()
  const parts = cleaned.split(/\s+/).filter(p => p.length >= 2 && p.length <= 8 && /^[\u4e00-\u9fa5]+$/.test(p))
  if (parts.length > 0) {
    parts.sort((a, b) => b.length - a.length)
    return parts[0]
  }
  return null
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  return fetchWithAntiCrawler(url, {}, ms)
}

// ========== 数据获取函数 ==========
export async function searchStock(keyword: string, db?: D1Database): Promise<any> {
  if (db) {
    try {
      const { results } = await db.prepare(`SELECT code, name, pinyin, market, industry
        FROM stock_basic
        WHERE code LIKE ?1 OR name LIKE ?2 OR pinyin LIKE ?3
        ORDER BY CASE
          WHEN code = ?1 THEN 0
          WHEN name = ?2 THEN 1
          WHEN code LIKE ?1 THEN 2
          WHEN name LIKE ?2 THEN 3
          ELSE 4
        END
        LIMIT 10`).bind(`${keyword}%`, `%${keyword}%`, `${keyword.toUpperCase()}%`).all()
      if (results && results.length > 0) {
        return {
          success: true,
          data: results.map((r: any) => ({
            code: r.code, name: r.name, market: r.market, industry: r.industry
          }))
        }
      }
    } catch (e) {
      console.warn('[search] D1 搜索失败:', (e as Error).message)
    }
  }

  const sources = [
    async () => {
      const r = await fetchWithTimeout(
        `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=5&token=D43BF722C8E33BDC906FB84D85E326E8`
      )
      const j = await r.json()
      if (j?.QuotationCodeTable?.Data?.length > 0) {
        return j.QuotationCodeTable.Data.map((it: any) => ({
          code: it.Code, name: it.Name, market: it.MktNum === '1' ? 'SH' : it.MktNum === '0' ? 'SZ' : 'BJ'
        }))
      }
      return null
    },
    async () => {
      const r = await fetchWithTimeout(
        `https://suggest3.sinajs.cn/suggest/type=111&key=${encodeURIComponent(keyword)}`
      )
      const text = await r.text()
      const m = text.match(/\{[\s\S]*\}/)
      if (m) {
        const j = JSON.parse(m[0])
        if (j.result?.length > 0) {
          return j.result.map((it: any) => ({
            code: it.code || '', name: it.name || '', market: it.code?.startsWith('6') ? 'SH' : 'SZ'
          })).filter((it: any) => it.code && it.name)
        }
      }
      return null
    },
    async () => {
      if (/^\d{6}$/.test(keyword)) {
        const market = keyword.startsWith('6') ? 'sh' : 'sz'
        const r = await fetchWithTimeout(`https://qt.gtimg.cn/q=${market}${keyword}`)
        const buf = await r.arrayBuffer()
        const text = new TextDecoder('gbk').decode(buf)
        const m = text.match(/v_[\w]+="([^"]+)"/)
        if (m) {
          const d = m[1].split('~')
          if (d.length >= 3 && d[1] && d[2]) {
            return [{ code: d[2], name: d[1], market: d[2]?.startsWith('6') ? 'SH' : 'SZ' }]
          }
        }
      }
      return null
    },
  ]

  for (const fn of sources) {
    try {
      const data = await fn()
      if (data && data.length > 0) {
        return { success: true, data }
      }
    } catch (e) { /* continue */ }
  }
  return { success: false, error: '未找到匹配的股票' }
}

export async function getStockQuote(code: string): Promise<any> {
  const ex = getMarket(code)
  const url = `https://qt.gtimg.cn/q=${ex}${code}`
  try {
    const r = await fetchWithTimeout(url)
    const buf = await r.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buf)
    const m = text.match(/v_[\w]+="([^"]+)"/)
    if (!m) return { success: false, error: '行情接口异常' }
    const d = m[1].split('~')
    if (d.length < 35) return { success: false, error: '行情数据不完整' }
    const price = parseFloat(d[3]) || 0
    const prevClose = parseFloat(d[4]) || 0
    if (!isValidPrice(price, prevClose)) return { success: false, error: '价格数据异常' }
    const result: any = {
      code, name: d[1] || '', price, prevClose,
      open: parseFloat(d[5]) || 0,
      change: parseFloat(d[31]) || (price - prevClose),
      changePercent: parseFloat(d[32]) || 0,
      high: parseFloat(d[33]) || 0, low: parseFloat(d[34]) || 0
    }
    if (d.length >= 46) {
      result.volume = parseFloat(d[6]) || 0
      result.turnover = parseFloat(d[37]) || 0
      result.turnoverRate = parseFloat(d[38]) || 0
      result.pe = parseFloat(d[39]) || 0
      result.pb = parseFloat(d[46]) || 0
      result.totalMarketCap = parseFloat(d[45]) || 0
      result.circulatingMarketCap = parseFloat(d[44]) || 0
    }
    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function getMarketIndices(): Promise<any> {
  const results: any[] = []
  const indices = [
    { code: 'sh000001', name: '上证指数' },
    { code: 'sz399001', name: '深证成指' },
    { code: 'sz399006', name: '创业板指' }
  ]
  for (const idx of indices) {
    try {
      const r = await fetchWithTimeout(`https://hq.sinajs.cn/list=${idx.code}`)
      const buf = await r.arrayBuffer()
      const text = new TextDecoder('gbk').decode(buf)
      const m = text.match(/var hq_str_[\w]+="([^"]+)"/)
      if (m) {
        const d = m[1].split(',')
        if (d.length >= 4) {
          const price = parseFloat(d[3]) || 0, prevClose = parseFloat(d[2]) || 0
          if (price > 0) results.push({
            name: idx.name, price,
            changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0
          })
        }
      }
    } catch { /* skip */ }
  }
  return results.length > 0
    ? { success: true, data: results }
    : { success: false, error: '大盘指数暂不可用' }
}

export async function getCompanyInfo(code: string): Promise<any> {
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_F10_ORG_BASICINFO&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)`
  try {
    const r = await fetchWithTimeout(url)
    const j = await r.json()
    if (j?.success && j?.result?.data?.length > 0) {
      const d = j.result.data[0]
      return {
        success: true,
        data: {
          name: d.SECURITY_NAME_ABBR || '',
          fullName: d.ORG_NAME || '',
          industry: d.EM2016 || '',
          industry2: d.BOARD_NAME_2LEVEL || '',
          industry3: d.BOARD_NAME_3LEVEL || '',
          concepts: d.BLGAINIAN || '',
          region: d.REGIONBK || '',
          listingDate: d.LISTING_DATE ? d.LISTING_DATE.split(' ')[0] : '',
          mainBusiness: d.MAIN_BUSINESS || '',
          chairman: d.CHAIRMAN || '',
          employees: d.TOTAL_NUM || 0
        }
      }
    }
    return { success: false, error: '公司信息暂不可用' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function searchStockNews(code: string, name: string): Promise<any> {
  const sources = [
    async () => {
      const url = `https://news.sina.com.cn/c/2/${code}.json`
      try {
        const r = await fetchWithTimeout(url)
        const j = await r.json()
        if (j?.result?.list && j.result.list.length > 0) {
          return j.result.list.slice(0, 8).map((item: any) => ({
            title: item.title || '',
            time: item.date || '',
            source: item.source || '新浪财经',
            summary: item.intro || '',
            url: item.url || ''
          }))
        }
      } catch { /* continue */ }
      return null
    },
    async () => {
      const url = `https://searchapi.eastmoney.com/api/search/get?keyword=${encodeURIComponent(name)}&type=news&pageSize=8&client=web`
      try {
        const r = await fetchWithTimeout(url)
        const j = await r.json()
        if (j?.success && j?.result?.data?.length > 0) {
          return j.result.data.slice(0, 8).map((item: any) => ({
            title: item.Title || '',
            time: item.ShowTime || '',
            source: item.Source || '东方财富',
            summary: item.Digest || '',
            url: item.Url || ''
          }))
        }
      } catch { /* continue */ }
      return null
    },
    async () => {
      const url = `https://api.money.126.net/data/newslist/roll/news_brief.js?limit=8`
      try {
        const r = await fetchWithTimeout(url)
        const text = await r.text()
        const m = text.match(/\{[\s\S]*\}/)
        if (m) {
          const j = JSON.parse(m[0])
          if (j?.result?.data?.length > 0) {
            return j.result.data.slice(0, 8).map((item: any) => ({
              title: item.title || '',
              time: item.publish_time || '',
              source: item.source || '网易财经',
              summary: item.summary || '',
              url: item.url || ''
            }))
          }
        }
      } catch { /* continue */ }
      return null
    }
  ]

  for (const fn of sources) {
    const data = await fn()
    if (data && data.length > 0) {
      return { success: true, data }
    }
  }
  return { success: false, error: '新闻数据暂不可用' }
}

export async function getIndustryPeers(code: string, industry: string): Promise<any> {
  if (!industry) return { success: false, error: '行业信息缺失' }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=SECURITY_CODE,SECURITY_NAME_ABBR,TOTAL_OPERATE_INCOME,PARENT_NETPROFIT,REPORT_DATE&filter=(INDUSTRYCODE3%3D%22${encodeURIComponent(industry)}%22)&pageSize=15&sortColumns=PARENT_NETPROFIT&sortTypes=-1`
    const r = await fetchWithTimeout(url)
    const j = await r.json()
    if (j?.success && j?.result?.data?.length > 0) {
      const peers = j.result.data.slice(0, 10).map((item: any) => ({
        code: item.SECURITY_CODE || '',
        name: item.SECURITY_NAME_ABBR || '',
        revenue: item.TOTAL_OPERATE_INCOME || 0,
        netProfit: item.PARENT_NETPROFIT || 0,
        reportDate: item.REPORT_DATE ? item.REPORT_DATE.split(' ')[0] : ''
      }))
      return { success: true, data: peers }
    }
  } catch { /* continue */ }

  try {
    const url = `https://searchapi.eastmoney.com/api/search/get?keyword=${encodeURIComponent(industry)}&type=14&pageSize=10&client=web`
    const r = await fetchWithTimeout(url)
    const j = await r.json()
    if (j?.QuotationCodeTable?.Data?.length > 0) {
      const peers = j.QuotationCodeTable.Data.slice(0, 10).map((item: any) => ({
        code: item.Code || '',
        name: item.Name || '',
        industry: item.Industry || ''
      }))
      return { success: true, data: peers }
    }
  } catch { /* continue */ }

  return { success: false, error: '行业对标数据暂不可用' }
}

export async function getFinancialData(code: string): Promise<any> {
  try {
    const incomeUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageSize=2&sortColumns=REPORT_DATE&sortTypes=-1`
    const incomeR = await fetchWithTimeout(incomeUrl)
    const incomeJ = await incomeR.json()
    const balanceUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_BALANCE&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageSize=2&sortColumns=REPORT_DATE&sortTypes=-1`
    const balanceR = await fetchWithTimeout(balanceUrl)
    const balanceJ = await balanceR.json()
    const result: any = {}
    if (incomeJ?.success && incomeJ?.result?.data?.length > 0) {
      const inc = incomeJ.result.data[0]
      result.reportDate = inc.REPORT_DATE ? inc.REPORT_DATE.split(' ')[0] : ''
      result.revenue = inc.TOTAL_OPERATE_INCOME || 0
      result.revenueGrowth = inc.TOI_RATIO || 0
      result.netProfit = inc.PARENT_NETPROFIT || 0
      result.netProfitGrowth = inc.PARENT_NETPROFIT_RATIO || 0
      result.grossProfitMargin = inc.TOTAL_OPERATE_INCOME && inc.OPERATE_COST
        ? ((inc.TOTAL_OPERATE_INCOME - inc.OPERATE_COST) / inc.TOTAL_OPERATE_INCOME) * 100
        : 0
    }
    if (balanceJ?.success && balanceJ?.result?.data?.length > 0) {
      const bal = balanceJ.result.data[0]
      result.totalAssets = bal.TOTAL_ASSETS || 0
      result.debtAssetRatio = bal.DEBT_ASSET_RATIO || 0
      result.cash = bal.MONETARYFUNDS || 0
    }
    return result.reportDate || result.revenue
      ? { success: true, data: result }
      : { success: false, error: '财务数据暂不可用' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// 缓存层 - 避免对相同股票/大盘的重复请求
interface CacheEntry<T = any> {
  data: T
  timestamp: number
}

class StockDataCache {
  private cache = new Map<string, CacheEntry>()
  private readonly TTL = {
    quote: 30 * 1000,        // 行情：30 秒
    indices: 60 * 1000,       // 大盘：60 秒
    company: 24 * 60 * 60 * 1000,  // 公司信息：24 小时
    financial: 6 * 60 * 60 * 1000, // 财务：6 小时
    news: 10 * 60 * 1000,     // 新闻：10 分钟
    peers: 6 * 60 * 60 * 1000, // 行业对标：6 小时
    search: 5 * 60 * 1000,    // 搜索：5 分钟
  }

  get<T>(key: string, type: keyof typeof this.TTL): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.TTL[type]) {
      this.cache.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      // 默认最大 TTL 24 小时
      if (now - entry.timestamp > 24 * 60 * 60 * 1000) {
        this.cache.delete(key)
      }
    }
  }
}

export const stockDataCache = new StockDataCache()

// 带缓存的包装器
export async function getCachedStockQuote(code: string): Promise<any> {
  const key = `quote:${code}`
  const cached = stockDataCache.get<any>(key, 'quote')
  if (cached) return cached
  const result = await getStockQuote(code)
  if (result.success) {
    stockDataCache.set(key, result)
  }
  return result
}

export async function getCachedMarketIndices(): Promise<any> {
  const key = 'indices:main'
  const cached = stockDataCache.get<any>(key, 'indices')
  if (cached) return cached
  const result = await getMarketIndices()
  if (result.success) {
    stockDataCache.set(key, result)
  }
  return result
}

export async function getCachedCompanyInfo(code: string): Promise<any> {
  const key = `company:${code}`
  const cached = stockDataCache.get<any>(key, 'company')
  if (cached) return cached
  const result = await getCompanyInfo(code)
  if (result.success) {
    stockDataCache.set(key, result)
  }
  return result
}

export async function getCachedFinancialData(code: string): Promise<any> {
  const key = `financial:${code}`
  const cached = stockDataCache.get<any>(key, 'financial')
  if (cached) return cached
  const result = await getFinancialData(code)
  if (result.success) {
    stockDataCache.set(key, result)
  }
  return result
}

export async function getCachedStockNews(code: string, name: string): Promise<any> {
  const key = `news:${code}`
  const cached = stockDataCache.get<any>(key, 'news')
  if (cached) return cached
  const result = await searchStockNews(code, name)
  if (result.success) {
    stockDataCache.set(key, result)
  }
  return result
}

export async function getCachedIndustryPeers(code: string, industry: string): Promise<any> {
  const key = `peers:${code}:${industry}`
  const cached = stockDataCache.get<any>(key, 'peers')
  if (cached) return cached
  const result = await getIndustryPeers(code, industry)
  if (result.success) {
    stockDataCache.set(key, result)
  }
  return result
}

export async function getCachedSearchStock(keyword: string, db?: D1Database): Promise<any> {
  const key = `search:${keyword.toLowerCase()}`
  const cached = stockDataCache.get<any>(key, 'search')
  if (cached) return cached
  const result = await searchStock(keyword, db)
  if (result.success) {
    stockDataCache.set(key, result)
  }
  return result
}

// 构建分析上下文
export function buildAnalysisContext(query: string, userContext: string, data: GatheredData): string {
  let context = ''

  if (userContext) {
    context += `## 用户持仓与资产概况\n${userContext}\n\n`
  }

  context += `## 用户问题\n${query}\n\n`

  if (data.indices) {
    context += `## 大盘环境\n`
    data.indices.forEach((i: any) => {
      const sign = i.changePercent >= 0 ? '+' : ''
      context += `- ${i.name}: ${i.price.toFixed(2)} (${sign}${i.changePercent.toFixed(2)}%)\n`
    })
    context += '\n'
  }

  if (data.stock && data.quote) {
    const s = data.stock
    const q = data.quote
    const sign = q.changePercent >= 0 ? '+' : ''
    context += `## 目标股票：${s.name}(${s.code})\n\n`
    context += `### 实时行情\n`
    context += `- 现价：¥${q.price.toFixed(2)} (${sign}${q.changePercent.toFixed(2)}%)\n`
    context += `- 涨跌额：${sign}${q.change?.toFixed?.(2) || 'N/A'}\n`
    context += `- 今开：¥${q.open?.toFixed?.(2) || 'N/A'}\n`
    context += `- 最高：¥${q.high?.toFixed?.(2) || 'N/A'}\n`
    context += `- 最低：¥${q.low?.toFixed?.(2) || 'N/A'}\n`
    if (q.pe) context += `- PE(TTM)：${q.pe.toFixed(2)}\n`
    if (q.pb) context += `- PB：${q.pb.toFixed(2)}\n`
    if (q.totalMarketCap) context += `- 总市值：${(q.totalMarketCap / 100000000).toFixed(2)}亿\n`
    if (q.turnoverRate) context += `- 换手率：${q.turnoverRate.toFixed(2)}%\n`
    context += '\n'
  }

  if (data.company) {
    const c = data.company
    context += `### 公司基本信息\n`
    if (c.industry2 || c.industry) context += `- 所属行业：${c.industry2 || c.industry}\n`
    if (c.region) context += `- 所属地区：${c.region}\n`
    if (c.listingDate) context += `- 上市日期：${c.listingDate}\n`
    if (c.mainBusiness) context += `- 主营业务：${c.mainBusiness.slice(0, 200)}\n`
    if (c.concepts) context += `- 概念板块：${c.concepts}\n`
    context += '\n'
  }

  if (data.financial) {
    const f = data.financial
    context += `### 财务数据 (${f.reportDate || '最新'})\n`
    if (f.revenue) {
      const rev = f.revenue / 100000000
      context += `- 营业收入：${rev.toFixed(2)}亿元`
      if (f.revenueGrowth) context += ` (同比 ${f.revenueGrowth >= 0 ? '+' : ''}${f.revenueGrowth.toFixed(2)}%)`
      context += '\n'
    }
    if (f.netProfit) {
      const np = f.netProfit / 100000000
      context += `- 净利润：${np.toFixed(2)}亿元`
      if (f.netProfitGrowth) context += ` (同比 ${f.netProfitGrowth >= 0 ? '+' : ''}${f.netProfitGrowth.toFixed(2)}%)`
      context += '\n'
    }
    if (f.grossProfitMargin) context += `- 毛利率：${f.grossProfitMargin.toFixed(2)}%\n`
    if (f.totalAssets) context += `- 总资产：${(f.totalAssets / 100000000).toFixed(2)}亿元\n`
    if (f.debtAssetRatio) context += `- 资产负债率：${f.debtAssetRatio.toFixed(2)}%\n`
    if (f.cash) context += `- 货币资金：${(f.cash / 100000000).toFixed(2)}亿元\n`
    context += '\n'
  }

  if (data.news && data.news.length > 0) {
    context += `### 近期新闻动态\n`
    data.news.slice(0, 5).forEach((n: any, idx: number) => {
      context += `${idx + 1}. [${n.time || ''}] ${n.source || ''}：${n.title || ''}\n`
      if (n.summary) context += `   ${n.summary.slice(0, 80)}...\n`
    })
    context += '\n'
  }

  if (data.peers && data.peers.length > 0) {
    context += `### 同行业对标公司\n`
    data.peers.slice(0, 6).forEach((p: any, idx: number) => {
      context += `${idx + 1}. ${p.name}(${p.code})`
      if (p.revenue) {
        const rev = p.revenue / 100000000
        context += ` - 营收${rev.toFixed(2)}亿`
      }
      if (p.netProfit) {
        const np = p.netProfit / 100000000
        context += ` - 净利${np.toFixed(2)}亿`
      }
      context += '\n'
    })
    context += '\n'
  }

  return context
}

// 专业级 AI 投研系统提示词
export const SYSTEM_PROMPT = `你是一名资深的 A 股 / 港股投资研究分析师，专注于为普通投资者提供专业、易懂、可落地的研究分析。

## 你的任务
基于提供的实时市场数据、新闻、行业对标、财务数据，按照"投研报告"标准生成专业、客观、有深度的研究结论。

## 分析框架（请严格按以下结构输出）

### 一、大盘环境研判（200字以内）
- 当前市场情绪：看多/看空/震荡，需给出明确判断和依据
- 主要指数表现：解读上证/深证/创业板走势含义
- 对目标个股的宏观影响：政策面、流动性、风险偏好

### 二、行业与公司分析（300字以内）
- 行业地位：龙头/跟随/挑战者，市占率情况
- 主营业务：核心产品/服务、收入结构、护城河
- 竞争优势：相比同行（参考"同行业对标公司"数据）的差异化
- 行业周期：当前行业处于哪个阶段

### 三、财务质量评估（300字以内）
- 营收增长：近 1-2 季同比变化，趋势是否健康
- 盈利能力：毛利率、净利率绝对水平和变化
- 资产质量：资产负债率、现金流、应收账款风险
- **关键财务评分**（用一段话总结：优秀/良好/一般/较差）

### 四、估值与技术面（300字以内）
- 估值水平：PE/PB 的绝对值和历史分位判断（高估/合理/低估）
- 技术形态：当前价格相对近期高低位的状态
- **关键支撑位**：基于近期低点和技术位
- **关键压力位**：基于近期高点和技术位

### 五、新闻催化与情绪面（200字以内）
- 重点解读"近期新闻动态"中的关键事件
- 区分：催化（利好）/ 风险（利空）/ 中性
- 关注：业绩预告、战略合作、政策变化、股东减持、行业事件

### 六、风险提示（不少于 3 条）
- 行业风险：政策变化、竞争加剧
- 公司风险：业绩、商誉、治理
- 市场风险：系统性风险、流动性

### 七、操作建议（必须具体可执行）
- **投资评级**：强烈推荐 / 推荐 / 中性 / 谨慎 / 回避（5 档，明确给出）
- **建议持仓比例**：占总仓位的 X%（基于风险等级给具体数字）
- **买入策略**：建议分批建仓（如 3 批），每批价位
- **止损位**：明确的价格或百分比（如 -8% 或 ¥XX）
- **目标价**：3-6 个月目标价位（基于估值）
- **持有周期**：短线（1 个月内）/ 中线（1-3 个月）/ 长线（6 个月+）

## 重要规则
1. **所有结论必须有数据支撑**：引用的数据请在结尾用 [来源] 标注（如 [行情]、[财务]、[新闻]）
2. **禁止模糊表述**：避免"可能"、"也许"、"或许"等含糊用词，除非确实数据不足
3. **数字要精确**：百分比保留 2 位小数，价格保留 2 位小数
4. **每只股票必须给出明确止损线**：这是风险管理的核心，不可省略
5. **客观中立**：既讲优势也讲风险，不诱导操作
6. **数据不足时明确标注**：使用"⚠️ 数据不足"标识，并说明需补充什么
7. **必须利用新闻数据**：新闻往往是短期股价的最强催化剂
8. **必须进行行业对比**：用"同行业对标公司"数据判断相对位置
9. **使用 Markdown 格式**：层级清晰，重点加粗，便于阅读
10. **避免晦涩术语**：用通俗语言解释专业概念

## 输出要求
- 总字数控制在 1200-1800 字之间
- 重点突出：评级、止损、目标价、仓位（这 4 项加粗）
- 结尾固定包含风险免责声明

## 免责声明
> ⚠️ **风险提示**：以上分析基于公开数据和研究方法，仅为研究参考，不构成投资建议。投资有风险，入市需谨慎。`

export const MODEL_LIST = [
  '@cf/zai-org/glm-4.7-flash',
  '@cf/qwen/qwen2.5-14b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
]

// 提取 AI 回复内容（处理不同模型的响应格式）
export function extractAIResponse(response: any): string {
  if (typeof response === 'string') return response
  if (response?.response) return response.response
  if (response?.choices?.[0]?.message?.content) return response.choices[0].message.content
  if (response?.output?.text) return response.output.text
  return String(response)
}
