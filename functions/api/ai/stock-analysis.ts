// POST /api/ai/stock-analysis
// 智能股票分析：Function Calling Agent
// 自动搜索股票 + 获取全面数据 + 联网实时信息 + AI多步深度分析
// Body: { query: "用户的问题", context?: "用户财务概况" }

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'
import { fetchWithAntiCrawler, buildRequestHeaders } from '../../lib/anti-crawler'

interface Env {
  AI: Ai
  DB: D1Database
  JWT_SECRET?: string
}

// 模型列表：优先使用支持 Function Calling 的模型
const MODEL_LIST = [
  '@cf/zai-org/glm-4.7-flash',      // 首选：支持工具调用，中文优化
  '@cf/qwen/qwen2.5-14b-instruct',   // 备选
  '@cf/meta/llama-3.2-3b-instruct',  // 备选
]

// ==================== 工具 Schema 定义 ====================

interface Tool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

const TOOLS: any[] = [
  {
    type: 'function',
    function: {
      name: 'search_stock',
      description: '搜索 A 股股票代码和名称。当用户提到股票名称但不知道代码时使用。输入股票名称的中文或拼音缩写，返回匹配的股票列表。',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '股票名称、拼音缩写或关键字'
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_stock_quote',
      description: '获取指定股票的实时行情数据。包括最新价、涨跌幅、成交量、市盈率、市净率、总市值等核心指标。',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '股票代码（6位数字，如 600519）'
          }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_data',
      description: '获取股票的财务数据，包括营收、净利润、毛利率、资产负债率等财务指标。用于基本面分析。',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '股票代码（6位数字）'
          }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_company_info',
      description: '获取股票对应的公司基本信息，包括所属行业、主营业务、概念板块、上市时间、管理层等。',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '股票代码（6位数字）'
          }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_indices',
      description: '获取大盘指数实时行情，包括上证指数、深证成指、创业板指。用于判断市场整体环境。',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_news',
      description: '搜索股票的实时新闻、公告、研报等信息。输入股票代码或名称，返回最新相关信息。',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词（股票代码、名称或相关主题）'
          }
        },
        required: ['keyword']
      }
    }
  }
]

// ==================== 工具执行函数 ====================

interface ToolResult {
  success: boolean
  data?: any
  error?: string
}

// 股票搜索
async function executeSearchStock(keyword: string, db?: D1Database): Promise<ToolResult> {
  // 优先走 D1
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
            code: r.code,
            name: r.name,
            market: r.market,
            industry: r.industry
          }))
        }
      }
    } catch (e) {
      console.warn('[search] D1 搜索失败，fallback 到外部:', (e as Error).message)
    }
  }

  // Fallback: 多源搜索
  try {
    const sources = [
      async () => {
        const r = await fetchWithTimeout(
          `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=5&token=D43BF722C8E33BDC906FB84D85E326E8`
        )
        const j: any = await r.json()
        if (j?.QuotationCodeTable?.Data && Array.isArray(j.QuotationCodeTable.Data)) {
          return j.QuotationCodeTable.Data.map((it: any) => ({
            code: it.Code,
            name: it.Name,
            market: it.MktNum === '1' ? 'SH' : it.MktNum === '0' ? 'SZ' : 'BJ'
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
      async () => {
        const r = await fetchWithTimeout(
          `https://www.10jqka.com.cn/api/search/stock/?keyword=${encodeURIComponent(keyword)}`
        )
        const j: any = await r.json()
        if (j?.data?.list?.length > 0) {
          return j.data.list.map((it: any) => ({
            code: it.code || '', name: it.name || '', market: it.code?.startsWith('6') ? 'SH' : 'SZ'
          })).filter((it: any) => it.code && it.name)
        }
        return null
      },
      async () => {
        const r = await fetchWithTimeout(
          `https://xueqiu.com/stock/search.json?code=${encodeURIComponent(keyword)}&size=5&page=1`
        )
        const j: any = await r.json()
        if (j?.stocks?.length > 0) {
          return j.stocks.map((it: any) => ({
            code: it.code?.replace(/^[a-zA-Z]+/, '') || '',
            name: it.name || '',
            market: it.code?.startsWith('SH') ? 'SH' : it.code?.startsWith('SZ') ? 'SZ' : 'BJ'
          })).filter((it: any) => it.code && it.name)
        }
        return null
      }
    ]

    for (const fn of sources) {
      try {
        const data = await fn()
        if (data && data.length > 0) {
          return { success: true, data }
        }
      } catch (e) {
        // continue
      }
    }
    return { success: false, error: '未找到匹配的股票' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// 获取股票行情
async function executeGetStockQuote(code: string): Promise<ToolResult> {
  try {
    const ex = getMarket(code)
    const url = `https://qt.gtimg.cn/q=${ex}${code}`
    const r = await fetchWithTimeout(url)
    const buf = await r.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buf)
    const m = text.match(/v_[\w]+="([^"]+)"/)
    if (!m) return { success: false, error: '行情接口返回数据异常' }
    
    const d = m[1].split('~')
    if (d.length < 35) return { success: false, error: '行情数据不完整' }
    
    const price = parseFloat(d[3]) || 0
    const prevClose = parseFloat(d[4]) || 0
    if (!isValidPrice(price, prevClose)) return { success: false, error: '价格数据异常' }
    
    const result: any = {
      code,
      name: d[1] || '',
      price,
      prevClose,
      open: parseFloat(d[5]) || 0,
      change: parseFloat(d[31]) || (price - prevClose),
      changePercent: parseFloat(d[32]) || 0,
      high: parseFloat(d[33]) || 0,
      low: parseFloat(d[34]) || 0
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

// 获取财务数据
async function executeGetFinancialData(code: string): Promise<ToolResult> {
  try {
    const incomeUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageSize=2&sortColumns=REPORT_DATE&sortTypes=-1`
    const incomeR = await fetchWithTimeout(incomeUrl)
    const incomeJ: any = await incomeR.json()
    
    const balanceUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_BALANCE&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageSize=2&sortColumns=REPORT_DATE&sortTypes=-1`
    const balanceR = await fetchWithTimeout(balanceUrl)
    const balanceJ: any = await balanceR.json()
    
    const result: any = {}
    
    if (incomeJ?.success && incomeJ?.result?.data?.length > 0) {
      const inc = incomeJ.result.data[0]
      result.reportDate = inc.REPORT_DATE ? inc.REPORT_DATE.split(' ')[0] : ''
      result.revenue = inc.TOTAL_OPERATE_INCOME || 0
      result.revenueGrowth = inc.TOI_RATIO || 0
      result.netProfit = inc.PARENT_NETPROFIT || 0
      result.netProfitGrowth = inc.PARENT_NETPROFIT_RATIO || 0
      result.deductNetProfit = inc.DEDUCT_PARENT_NETPROFIT || 0
      result.grossProfitMargin = inc.TOTAL_OPERATE_INCOME && inc.OPERATE_COST
        ? ((inc.TOTAL_OPERATE_INCOME - inc.OPERATE_COST) / inc.TOTAL_OPERATE_INCOME) * 100
        : 0
    }
    
    if (balanceJ?.success && balanceJ?.result?.data?.length > 0) {
      const bal = balanceJ.result.data[0]
      result.totalAssets = bal.TOTAL_ASSETS || 0
      result.totalLiabilities = bal.TOTAL_LIABILITIES || 0
      result.debtAssetRatio = bal.DEBT_ASSET_RATIO || 0
      result.cash = bal.MONETARYFUNDS || 0
    }
    
    if (!result.reportDate && !result.revenue) {
      return { success: false, error: '财务数据暂不可用' }
    }
    
    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// 获取公司信息
async function executeGetCompanyInfo(code: string): Promise<ToolResult> {
  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_F10_ORG_BASICINFO&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)`
    const r = await fetchWithTimeout(url)
    const j: any = await r.json()
    if (j?.success && j?.result?.data?.length > 0) {
      const d = j.result.data[0]
      return {
        success: true,
        data: {
          name: d.SECURITY_NAME_ABBR || '',
          fullName: d.ORG_NAME || '',
          industry: d.EM2016 || '',
          industry1: d.BOARD_NAME_1LEVEL || '',
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

// 获取大盘指数
async function executeGetMarketIndices(): Promise<ToolResult> {
  try {
    const results: any[] = []
    const indices = [
      { code: 'sh000001', name: '上证指数' },
      { code: 'sz399001', name: '深证成指' },
      { code: 'sz399006', name: '创业板指' }
    ]
    
    for (const idx of indices) {
      try {
        const url = `https://hq.sinajs.cn/list=${idx.code}`
        const r = await fetchWithTimeout(url)
        const buf = await r.arrayBuffer()
        const text = new TextDecoder('gbk').decode(buf)
        const m = text.match(/var hq_str_[\w]+="([^"]+)"/)
        if (m) {
          const d = m[1].split(',')
          if (d.length >= 4) {
            const price = parseFloat(d[3]) || 0
            const prevClose = parseFloat(d[2]) || 0
            if (price > 0) {
              results.push({
                name: idx.name,
                price,
                changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0
              })
            }
          }
        }
      } catch {}
    }
    
    if (results.length === 0) {
      return { success: false, error: '大盘指数暂不可用' }
    }
    
    return { success: true, data: results }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// 搜索新闻（使用 DuckDuckGo 免费搜索）
async function executeSearchNews(keyword: string): Promise<ToolResult> {
  try {
    // 使用 DuckDuckGo HTML 搜索（免费，无需 API Key）
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(keyword + ' 股票 新闻 site:eastmoney.com OR site:sina.com.cn OR site:10jqka.com.cn')}&kl=cn-zh`
    const r = await fetchWithTimeout(url)
    const text = await r.text()
    
    // 解析搜索结果
    const results: any[] = []
    const matches = text.match(/<a class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)</g)
    
    if (matches) {
      for (let i = 0; i < Math.min(matches.length, 5); i++) {
        const hrefMatch = matches[i].match(/href="([^"]*)"/)
        const titleMatch = matches[i].match(/>([^<]*)</)
        if (hrefMatch && titleMatch) {
          results.push({
            title: titleMatch[1].replace(/<[^>]*>/g, '').trim(),
            url: hrefMatch[1]
          })
        }
      }
    }
    
    if (results.length === 0) {
      // Fallback: 尝试东方财富公告搜索
      const emUrl = `https://search-api-web.eastmoney.com/search/jsonp?cb=jQuery&param={"uid":"","keyword":"${encodeURIComponent(keyword)}","type":["cmsArticle"],"client":"web","clientType":"pc","clientVersion":"curr","param":{"pageIndex":1,"pageSize":5,"preTag":"<em>","postTag":"</em>"}}`
      const emR = await fetchWithTimeout(emUrl, 5000)
      const emText = await emR.text()
      const emMatch = emText.match(/\"title\":\"([^\"]*)\"/g)
      if (emMatch) {
        for (let i = 0; i < Math.min(emMatch.length, 5); i++) {
          results.push({
            title: JSON.parse('{"' + emMatch[i] + '}').title || emMatch[i].match(/\"title\":\"([^\"]*)\"/)?.[1] || '公告/新闻',
            url: ''
          })
        }
      }
    }
    
    return { success: true, data: results.length > 0 ? results : [{ title: '暂未找到相关新闻', url: '' }] }
  } catch (e) {
    return { success: false, error: '新闻搜索暂不可用: ' + String(e) }
  }
}

// 工具执行器
async function executeTool(name: string, args: Record<string, any>, db?: D1Database): Promise<ToolResult> {
  switch (name) {
    case 'search_stock':
      return executeSearchStock(args.keyword, db)
    case 'get_stock_quote':
      return executeGetStockQuote(args.code)
    case 'get_financial_data':
      return executeGetFinancialData(args.code)
    case 'get_company_info':
      return executeGetCompanyInfo(args.code)
    case 'get_market_indices':
      return executeGetMarketIndices()
    case 'search_news':
      return executeSearchNews(args.keyword)
    default:
      return { success: false, error: `未知工具: ${name}` }
  }
}

// ==================== 辅助函数 ====================

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  return fetchWithAntiCrawler(url, {}, ms)
}

function getMarket(code: string): 'sh' | 'sz' | 'bj' | 'hk' {
  if (/^\d{5}$/.test(code)) return 'hk'
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'sh'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return 'sz'
  return 'bj'
}

function isValidPrice(price: number, prevClose: number): boolean {
  if (!isFinite(price) || price <= 0) return false
  if (price < 0.01 || price > 10000) return false
  if (isFinite(prevClose) && prevClose > 0) {
    const deviation = Math.abs(price - prevClose) / prevClose
    if (deviation > 0.3) return false
  }
  return true
}

// 提取股票关键词
function extractStockKeyword(query: string): string | null {
  const codeMatch = query.match(/\b[0-9]{6}\b/)
  if (codeMatch) return codeMatch[0]
  
  const prefixedMatch = query.match(/(sh|sz|bj)[0-9]{6}/i)
  if (prefixedMatch) return prefixedMatch[0].replace(/^(sh|sz|bj)/i, '')
  
  const stopWords = [
    '分析', '诊断', '评估', '研究', '看看', '说说', '推荐', '买入', '卖出',
    '怎么样', '如何', '什么', '能不能', '可以', '会', '吗', '呢',
    '今天', '明天', '最近', '现在', '目前', '股票', '个股', '标的',
    '这个', '那个', '持仓', '仓位', '行情', '走势'
  ]
  
  let cleaned = query
    .replace(new RegExp(stopWords.join('|'), 'gi'), ' ')
    .replace(/[，。？！,.!?、；：""''（）\(\)\s\d\-_/\\|]+/g, ' ')
    .trim()
  
  const parts = cleaned.split(/\s+/).filter(p => {
    if (p.length < 2 || p.length > 8) return false
    return /^[\u4e00-\u9fa5]+$/.test(p)
  })
  
  if (parts.length > 0) {
    parts.sort((a, b) => b.length - a.length)
    return parts[0]
  }
  
  return null
}

// ==================== AI 调用 ====================

async function runModelWithTools(AI: any, model: string, messages: Array<{role: string, content: string}>): Promise<any> {
  const response = await AI.run(model, { 
    messages,
    tools: TOOLS
  })
  return response
}

// ==================== 主函数 ====================

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const body = await context.request.json() as { query?: string, context?: string }
    if (!body.query || !body.query.trim()) {
      return jsonResponse({ ok: false, error: 'query required' }, 400)
    }

    const query = body.query.trim()
    const userContext = body.context || ''
    
    // 系统提示词
    const systemPrompt = `你是专业的股票投资分析师（15年经验 CFA 持证人），擅长个股深度分析、行业研究和投资决策。

## 核心能力
1. 你可以主动调用工具获取实时数据
2. 分析路径：大盘环境 → 行业判断 → 个股分析 → 操作建议
3. 所有事实性陈述必须基于工具获取的真实数据

## 工具调用规则
- 当你需要股票代码时，使用 search_stock
- 当你需要实时行情时，使用 get_stock_quote
- 当你需要财务数据时，使用 get_financial_data
- 当你需要公司信息时，使用 get_company_info
- 当你需要判断大盘环境时，使用 get_market_indices
- 当你需要最新新闻/催化事件时，使用 search_news

## 绝对规则
1. 禁止编造任何数据，数据不足必须明确标注"数据不足"
2. 股票身份（名称/代码）必须以工具返回的为准
3. 每只推荐股票必须有明确止损线
4. 所有分析仅为研究参考，不构成投资建议`

    // 用户提示词
    const userPrompt = `${userContext ? `## 用户财务概况\n${userContext}\n\n` : ''}## 用户问题\n${query}`

    // 构建初始消息
    const messages: Array<{role: string, content: string}> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    // Agent 循环：最多执行 5 轮工具调用
    const MAX_ITERATIONS = 5
    let iteration = 0
    let hasFinalAnswer = false
    let finalReply = ''
    const toolCallHistory: Array<{tool: string, args: any, result: any}> = []

    // 首先尝试自动提取并获取大盘指数
    const keyword = extractStockKeyword(query)
    if (keyword) {
      // 自动获取大盘指数
      const indicesResult = await executeGetMarketIndices()
      if (indicesResult.success) {
        const indicesText = indicesResult.data.map((i: any) => 
          `${i.name}: ${i.price.toFixed(2)} (${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%)`
        ).join('\n')
        messages.push({
          role: 'system',
          content: `【自动获取】大盘指数（当前市场环境）：\n${indicesText}`
        })
        
        // 自动搜索股票
        const searchResult = await executeSearchStock(keyword, context.env.DB)
        if (searchResult.success && searchResult.data.length > 0) {
          const stock = searchResult.data[0]
          messages.push({
            role: 'system',
            content: `【自动获取】股票搜索结果：「${keyword}」匹配到 ${stock.name}(${stock.code})，市场：${stock.market}`
          })
          
          // 自动获取行情
          const quoteResult = await executeGetStockQuote(stock.code)
          if (quoteResult.success) {
            const q = quoteResult.data
            const sign = q.changePercent >= 0 ? '+' : ''
            messages.push({
              role: 'system',
              content: `【自动获取】${q.name}(${q.code}) 实时行情：
- 最新价: ¥${q.price.toFixed(2)}
- 涨跌幅: ${sign}${q.changePercent.toFixed(2)}%
- 今开: ¥${q.open.toFixed(2)} / 昨收: ¥${q.prevClose.toFixed(2)}
- 最高: ¥${q.high.toFixed(2)} / 最低: ¥${q.low.toFixed(2)}
${q.pe ? `- 市盈率(PE): ${q.pe.toFixed(2)}` : ''}
${q.pb ? `- 市净率(PB): ${q.pb.toFixed(2)}` : ''}
${q.totalMarketCap ? `- 总市值: ${q.totalMarketCap.toFixed(2)}亿` : ''}`
            })
          }
          
          // 自动获取公司信息
          const companyResult = await executeGetCompanyInfo(stock.code)
          if (companyResult.success) {
            const c = companyResult.data
            messages.push({
              role: 'system',
              content: `【自动获取】${q?.name || stock.name} 公司信息：
- 所属行业: ${c.industry2 || c.industry || '数据不足'}
- 主营业务: ${c.mainBusiness || '数据不足'}
- 概念板块: ${c.concepts || '数据不足'}
${c.region ? `- 所在地区: ${c.region}` : ''}
${c.listingDate ? `- 上市时间: ${c.listingDate}` : ''}`
            })
          }
          
          // 自动获取财务数据
          const financialResult = await executeGetFinancialData(stock.code)
          if (financialResult.success) {
            const f = financialResult.data
            messages.push({
              role: 'system',
              content: `【自动获取】${q?.name || stock.name} 财务数据（${f.reportDate || '最近报告期'}）：
- 营业收入: ${f.revenue ? (f.revenue / 100000000).toFixed(2) + '亿' : '数据不足'}
- 营收同比: ${f.revenueGrowth ? (f.revenueGrowth >= 0 ? '+' : '') + f.revenueGrowth.toFixed(2) + '%' : '数据不足'}
- 归母净利润: ${f.netProfit ? (f.netProfit / 100000000).toFixed(2) + '亿' : '数据不足'}
- 净利同比: ${f.netProfitGrowth ? (f.netProfitGrowth >= 0 ? '+' : '') + f.netProfitGrowth.toFixed(2) + '%' : '数据不足'}
- 毛利率: ${f.grossProfitMargin ? f.grossProfitMargin.toFixed(2) + '%' : '数据不足'}
- 资产负债率: ${f.debtAssetRatio ? f.debtAssetRatio.toFixed(2) + '%' : '数据不足'}`
            })
          }
        }
      }
    }

    let response: any
    let modelUsed = ''

    // Agent 循环：调用 AI，决定是否需要更多工具
    while (iteration < MAX_ITERATIONS && !hasFinalAnswer) {
      iteration++
      
      response = undefined
      
      // 尝试不同模型
      for (const model of MODEL_LIST) {
        try {
          response = await runModelWithTools(context.env.AI, model, messages)
          modelUsed = model
          break
        } catch (e: any) {
          console.warn(`[ai] model ${model} failed: ${e?.message || e}`)
          if (model === MODEL_LIST[MODEL_LIST.length - 1]) {
            throw new Error(`所有模型均失败: ${e?.message || e}`)
          }
        }
      }

      // 检查是否有工具调用
      if (response?.tool_calls && response.tool_calls.length > 0) {
        const toolCall = response.tool_calls[0]
        const toolName = toolCall.function?.name || toolCall.name
        let toolArgs = {}
        
        try {
          toolArgs = JSON.parse(toolCall.function?.arguments || toolCall.arguments || '{}')
        } catch {
          toolArgs = {}
        }
        
        // 执行工具
        const toolResult = await executeTool(toolName, toolArgs, context.env.DB)
        toolCallHistory.push({ tool: toolName, args: toolArgs, result: toolResult })
        
        // 格式化工具结果
        let resultText = ''
        if (toolResult.success) {
          if (toolName === 'search_stock') {
            resultText = JSON.stringify(toolResult.data, null, 2)
          } else if (toolName === 'get_market_indices') {
            resultText = toolResult.data.map((i: any) => 
              `${i.name}: ${i.price.toFixed(2)} (${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%)`
            ).join('\n')
          } else if (toolName === 'search_news') {
            resultText = toolResult.data.map((n: any, i: number) => 
              `${i + 1}. ${n.title}${n.url ? ` (${n.url.slice(0, 50)}...)` : ''}`
            ).join('\n')
          } else {
            resultText = JSON.stringify(toolResult.data, null, 2)
          }
        } else {
          resultText = `错误: ${toolResult.error}`
        }
        
        // 将工具调用和结果加入消息
        messages.push({
          role: 'assistant',
          content: response.content || `[调用工具: ${toolName}]`
        })
        messages.push({
          role: 'tool',
          content: `工具 ${toolName} 执行结果:\n${resultText}`
        })
        
        // 追加到 tool_call_history 供后续使用
        messages.push({
          role: 'system',
          content: `【工具调用记录 #${toolCallHistory.length}】
工具: ${toolName}
参数: ${JSON.stringify(toolArgs)}
结果: ${resultText.slice(0, 500)}${resultText.length > 500 ? '...' : ''}`
        })
        
        continue // 继续循环
      }
      
      // 没有工具调用，检查是否有有效回复
      if (response?.content && response.content.trim().length > 50) {
        hasFinalAnswer = true
        finalReply = response.content
        
        // 添加分析完成标记
        finalReply += `\n\n---\n**本分析基于以上实时数据自动生成 | 工具调用 ${toolCallHistory.length} 次**\n`
        finalReply += `**风险提示**：以上分析仅为研究参考，不构成投资建议，投资有风险，入市需谨慎。`
      } else if (iteration >= MAX_ITERATIONS) {
        finalReply = response?.content || '分析超时，请稍后重试。'
        hasFinalAnswer = true
      }
    }

    return jsonResponse({
      ok: true,
      data: {
        reply: finalReply,
        model: modelUsed,
        iterations: iteration,
        toolsUsed: toolCallHistory.map(t => t.tool)
      }
    })

  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || 'Stock analysis failed' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
