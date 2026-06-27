// GET /api/ai/stock-analysis/stream
// SSE 流式股票分析：Function Calling Agent
// 支持实时工具调用状态和流式 AI 回复
// Query: ?query=xxx&context=xxx

import { getAuthUser, optionsResponse, requireAuth } from '../../lib/auth'
import { fetchWithAntiCrawler, buildRequestHeaders } from '../../lib/anti-crawler'

interface Env {
  AI: Ai
  DB: D1Database
  JWT_SECRET?: string
}

// 模型列表
const MODEL_LIST = [
  '@cf/zai-org/glm-4.7-flash',
  '@cf/qwen/qwen2.5-14b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
]

// 工具 Schema（OpenAI 兼容格式）
const TOOLS: any[] = [
  {
    type: 'function',
    function: {
      name: 'search_stock',
      description: '搜索 A 股股票代码和名称',
      parameters: {
        type: 'object',
        properties: { keyword: { type: 'string', description: '股票名称或关键字' } },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_stock_quote',
      description: '获取股票实时行情',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: '股票代码' } },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_data',
      description: '获取财务数据',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: '股票代码' } },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_company_info',
      description: '获取公司基本信息',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: '股票代码' } },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_indices',
      description: '获取大盘指数',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_news',
      description: '搜索新闻公告',
      parameters: {
        type: 'object',
        properties: { keyword: { type: 'string', description: '搜索关键词' } },
        required: ['keyword']
      }
    }
  }
]

// 工具名称映射
const TOOL_LABELS: Record<string, string> = {
  search_stock: '搜索股票',
  get_stock_quote: '获取行情',
  get_financial_data: '获取财务数据',
  get_company_info: '获取公司信息',
  get_market_indices: '获取大盘指数',
  search_news: '搜索新闻'
}

// SSE 发送函数
function sseFormat(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// 辅助函数
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

function extractStockKeyword(query: string): string | null {
  const codeMatch = query.match(/\b[0-9]{6}\b/)
  if (codeMatch) return codeMatch[0]
  const prefixedMatch = query.match(/(sh|sz|bj)[0-9]{6}/i)
  if (prefixedMatch) return prefixedMatch[0].replace(/^(sh|sz|bj)/i, '')
  const stopWords = ['分析', '诊断', '评估', '研究', '看看', '说说', '推荐', '买入', '卖出',
    '怎么样', '如何', '什么', '能不能', '可以', '会', '吗', '呢',
    '今天', '明天', '最近', '现在', '目前', '股票', '个股', '标的',
    '这个', '那个', '持仓', '仓位', '行情', '走势']
  let cleaned = query.replace(new RegExp(stopWords.join('|'), 'gi'), ' ')
    .replace(/[，。？！,.!?、；：""''（）\(\)\s\d\-_/\\|]+/g, ' ').trim()
  const parts = cleaned.split(/\s+/).filter(p => p.length >= 2 && p.length <= 8 && /^[\u4e00-\u9fa5]+$/.test(p))
  if (parts.length > 0) {
    parts.sort((a, b) => b.length - a.length)
    return parts[0]
  }
  return null
}

// 工具执行函数
async function executeTool(name: string, args: Record<string, any>, db?: D1Database): Promise<any> {
  try {
    switch (name) {
      case 'search_stock': {
        const keyword = args.keyword
        // 优先 D1
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
            console.warn('[search] D1 搜索失败，fallback:', (e as Error).message)
          }
        }

        // 尝试多个搜索源
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
          async () => {
            const r = await fetchWithTimeout(
              `https://www.10jqka.com.cn/api/search/stock/?keyword=${encodeURIComponent(keyword)}`
            )
            const j = await r.json()
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
            const j = await r.json()
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
            // 继续尝试下一个
          }
        }
        return { success: false, error: '未找到匹配的股票' }
      }
      case 'get_stock_quote': {
        const ex = getMarket(args.code)
        const url = `https://qt.gtimg.cn/q=${ex}${args.code}`
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
        const result: any = { code: args.code, name: d[1] || '', price, prevClose, open: parseFloat(d[5]) || 0,
          change: parseFloat(d[31]) || (price - prevClose), changePercent: parseFloat(d[32]) || 0,
          high: parseFloat(d[33]) || 0, low: parseFloat(d[34]) || 0 }
        if (d.length >= 46) {
          result.volume = parseFloat(d[6]) || 0; result.turnover = parseFloat(d[37]) || 0
          result.turnoverRate = parseFloat(d[38]) || 0; result.pe = parseFloat(d[39]) || 0
          result.pb = parseFloat(d[46]) || 0; result.totalMarketCap = parseFloat(d[45]) || 0
          result.circulatingMarketCap = parseFloat(d[44]) || 0
        }
        return { success: true, data: result }
      }
      case 'get_market_indices': {
        const results: any[] = []
        const indices = [{ code: 'sh000001', name: '上证指数' }, { code: 'sz399001', name: '深证成指' }, { code: 'sz399006', name: '创业板指' }]
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
                if (price > 0) results.push({ name: idx.name, price, changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0 })
              }
            }
          } catch {}
        }
        return results.length > 0 ? { success: true, data: results } : { success: false, error: '大盘指数暂不可用' }
      }
      case 'get_company_info': {
        const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_F10_ORG_BASICINFO&columns=ALL&filter=(SECURITY_CODE%3D%22${args.code}%22)`
        const r = await fetchWithTimeout(url)
        const j = await r.json()
        if (j?.success && j?.result?.data?.length > 0) {
          const d = j.result.data[0]
          return { success: true, data: {
            name: d.SECURITY_NAME_ABBR || '', fullName: d.ORG_NAME || '',
            industry: d.EM2016 || '', industry2: d.BOARD_NAME_2LEVEL || '', industry3: d.BOARD_NAME_3LEVEL || '',
            concepts: d.BLGAINIAN || '', region: d.REGIONBK || '', listingDate: d.LISTING_DATE ? d.LISTING_DATE.split(' ')[0] : '',
            mainBusiness: d.MAIN_BUSINESS || '', chairman: d.CHAIRMAN || '', employees: d.TOTAL_NUM || 0
          }}
        }
        return { success: false, error: '公司信息暂不可用' }
      }
      case 'get_financial_data': {
        const incomeUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=ALL&filter=(SECURITY_CODE%3D%22${args.code}%22)&pageSize=2&sortColumns=REPORT_DATE&sortTypes=-1`
        const incomeR = await fetchWithTimeout(incomeUrl)
        const incomeJ = await incomeR.json()
        const balanceUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_BALANCE&columns=ALL&filter=(SECURITY_CODE%3D%22${args.code}%22)&pageSize=2&sortColumns=REPORT_DATE&sortTypes=-1`
        const balanceR = await fetchWithTimeout(balanceUrl)
        const balanceJ = await balanceR.json()
        const result: any = {}
        if (incomeJ?.success && incomeJ?.result?.data?.length > 0) {
          const inc = incomeJ.result.data[0]
          result.reportDate = inc.REPORT_DATE ? inc.REPORT_DATE.split(' ')[0] : ''
          result.revenue = inc.TOTAL_OPERATE_INCOME || 0; result.revenueGrowth = inc.TOI_RATIO || 0
          result.netProfit = inc.PARENT_NETPROFIT || 0; result.netProfitGrowth = inc.PARENT_NETPROFIT_RATIO || 0
          result.grossProfitMargin = inc.TOTAL_OPERATE_INCOME && inc.OPERATE_COST ? ((inc.TOTAL_OPERATE_INCOME - inc.OPERATE_COST) / inc.TOTAL_OPERATE_INCOME) * 100 : 0
        }
        if (balanceJ?.success && balanceJ?.result?.data?.length > 0) {
          const bal = balanceJ.result.data[0]
          result.totalAssets = bal.TOTAL_ASSETS || 0; result.debtAssetRatio = bal.DEBT_ASSET_RATIO || 0
          result.cash = bal.MONETARYFUNDS || 0
        }
        return result.reportDate || result.revenue ? { success: true, data: result } : { success: false, error: '财务数据暂不可用' }
      }
      case 'search_news': {
        const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(args.keyword + ' 股票 新闻 site:eastmoney.com OR site:sina.com.cn OR site:10jqka.com.cn')}&kl=cn-zh`
        const r = await fetchWithTimeout(url)
        const text = await r.text()
        const results: any[] = []
        const matches = text.match(/<a class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)</g)
        if (matches) {
          for (let i = 0; i < Math.min(matches.length, 5); i++) {
            const hrefMatch = matches[i].match(/href="([^"]*)"/)
            const titleMatch = matches[i].match(/>([^<]*)</)
            if (hrefMatch && titleMatch) results.push({ title: titleMatch[1].replace(/<[^>]*>/g, '').trim(), url: hrefMatch[1] })
          }
        }
        return { success: true, data: results.length > 0 ? results : [{ title: '暂未找到相关新闻', url: '' }] }
      }
      default:
        return { success: false, error: `未知工具: ${name}` }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  const url = new URL(context.request.url)
  const query = url.searchParams.get('query') || ''
  const userContext = url.searchParams.get('context') || ''

  if (!query.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'query required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(sseFormat(event, data)))
      }

      try {
        // 发送开始事件
        send('start', { status: '开始分析...' })
        
        const messages: any[] = []
        const systemPrompt = `你是专业的股票投资分析师（15年经验 CFA 持证人），擅长个股深度分析。

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
2. 每只推荐股票必须有明确止损线
3. 所有分析仅为研究参考，不构成投资建议`

        const userPrompt = `${userContext ? `## 用户财务概况\n${userContext}\n\n` : ''}## 用户问题\n${query}`
        messages.push({ role: 'system', content: systemPrompt })
        messages.push({ role: 'user', content: userPrompt })

        const MAX_ITERATIONS = 5
        let iteration = 0
        const toolCallHistory: any[] = []
        let finalReply = ''

        // 自动提取关键词并预获取数据
        const keyword = extractStockKeyword(query)
        if (keyword) {
          // 获取大盘指数
          send('tool_start', { tool: 'get_market_indices', label: '🔍 获取大盘指数...', status: 'running' })
          const indicesResult = await executeTool('get_market_indices', {}, context.env.DB)
          if (indicesResult.success) {
            const indicesText = indicesResult.data.map((i: any) => 
              `${i.name}: ${i.price.toFixed(2)} (${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%)`
            ).join('\n')
            messages.push({ role: 'system', content: `【自动获取】大盘指数：\n${indicesText}` })
            send('tool_end', { tool: 'get_market_indices', label: '✅ 大盘指数已获取', status: 'completed', data: indicesResult.data })
          } else {
            send('tool_end', { tool: 'get_market_indices', label: '⚠️ 大盘指数获取失败', status: 'error' })
          }

          // 搜索股票
          send('tool_start', { tool: 'search_stock', label: '🔍 搜索股票...', status: 'running' })
          const searchResult = await executeTool('search_stock', { keyword }, context.env.DB)
          if (searchResult.success && searchResult.data.length > 0) {
            const stock = searchResult.data[0]
            messages.push({ role: 'system', content: `【自动获取】股票搜索结果：${stock.name}(${stock.code})` })
            send('tool_end', { tool: 'search_stock', label: `✅ 已找到 ${stock.name}`, status: 'completed', data: stock })

            // 并行获取行情和公司信息
            send('tool_start', { tool: 'get_stock_quote', label: `📊 获取 ${stock.name} 行情...`, status: 'running' })
            const quoteResult = await executeTool('get_stock_quote', { code: stock.code }, context.env.DB)
            if (quoteResult.success) {
              const q = quoteResult.data
              const sign = q.changePercent >= 0 ? '+' : ''
              messages.push({ role: 'system', content: `【自动获取】行情：${q.name} ¥${q.price.toFixed(2)} ${sign}${q.changePercent.toFixed(2)}%` })
              send('tool_end', { tool: 'get_stock_quote', label: `✅ 行情 ¥${q.price.toFixed(2)}`, status: 'completed', data: q })
            } else {
              send('tool_end', { tool: 'get_stock_quote', label: '⚠️ 行情获取失败', status: 'error' })
            }

            send('tool_start', { tool: 'get_company_info', label: `🏢 获取公司信息...`, status: 'running' })
            const companyResult = await executeTool('get_company_info', { code: stock.code }, context.env.DB)
            if (companyResult.success) {
              const c = companyResult.data
              messages.push({ role: 'system', content: `【自动获取】公司信息：${c.industry2 || c.industry} | ${c.mainBusiness?.slice(0, 50)}` })
              send('tool_end', { tool: 'get_company_info', label: `✅ ${c.industry2 || '公司信息已获取'}`, status: 'completed', data: c })
            } else {
              send('tool_end', { tool: 'get_company_info', label: '⚠️ 公司信息获取失败', status: 'error' })
            }

            send('tool_start', { tool: 'get_financial_data', label: `💰 获取财务数据...`, status: 'running' })
            const financialResult = await executeTool('get_financial_data', { code: stock.code }, context.env.DB)
            if (financialResult.success) {
              const f = financialResult.data
              messages.push({ role: 'system', content: `【自动获取】财务数据：营收 ${f.revenue ? (f.revenue / 100000000).toFixed(2) + '亿' : '数据不足'}` })
              send('tool_end', { tool: 'get_financial_data', label: `✅ 财务数据已获取`, status: 'completed', data: f })
            } else {
              send('tool_end', { tool: 'get_financial_data', label: '⚠️ 财务数据获取失败', status: 'error' })
            }
          } else {
            send('tool_end', { tool: 'search_stock', label: '⚠️ 未找到股票', status: 'error' })
          }
        }

        // AI 分析循环
        send('start', { status: '🤔 正在深度分析...' })
        
        while (iteration < MAX_ITERATIONS) {
          iteration++
          
          let response: any
          for (const model of MODEL_LIST) {
            try {
              response = await context.env.AI.run(model, { messages, tools: TOOLS })
              break
            } catch (e) {
              if (model === MODEL_LIST[MODEL_LIST.length - 1]) throw e
            }
          }

          // 检查工具调用
          if (response?.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0]
            const toolName = toolCall.function?.name || toolCall.name
            let toolArgs = {}
            try { toolArgs = JSON.parse(toolCall.function?.arguments || toolCall.arguments || '{}') } catch {}
            
            const label = TOOL_LABELS[toolName] || toolName
            send('tool_start', { tool: toolName, label: `🔍 ${label}...`, status: 'running' })
            
            const toolResult = await executeTool(toolName, toolArgs, context.env.DB)
            toolCallHistory.push({ tool: toolName, args: toolArgs, result: toolResult })
            
            let resultText = ''
            if (toolResult.success) {
              if (toolName === 'get_market_indices') {
                resultText = toolResult.data.map((i: any) => `${i.name}: ${i.price.toFixed(2)}`).join(', ')
              } else if (toolName === 'search_news') {
                resultText = toolResult.data.map((n: any, i: number) => `${i + 1}. ${n.title}`).join('\n')
              } else {
                resultText = JSON.stringify(toolResult.data)
              }
            } else {
              resultText = `错误: ${toolResult.error}`
            }
            
            messages.push({ role: 'assistant', content: `[调用工具: ${toolName}]` })
            messages.push({ role: 'tool', content: `工具 ${toolName} 结果: ${resultText}` })
            messages.push({ role: 'system', content: `【工具调用】${toolName}: ${resultText.slice(0, 200)}` })
            
            send('tool_end', { tool: toolName, label: `✅ ${label}完成`, status: 'completed', data: toolResult })
            continue
          }
          
          // 最终回复
          if (response?.content && response.content.trim().length > 30) {
            finalReply = response.content
            finalReply += `\n\n---\n**本分析基于实时数据自动生成 | 工具调用 ${toolCallHistory.length} 次**\n`
            finalReply += `**风险提示**：以上分析仅为研究参考，不构成投资建议，投资有风险，入市需谨慎。`
            
            send('token_start', { status: '开始输出分析结果...' })
            
            // 流式发送内容
            const chars = finalReply.split('')
            let buffer = ''
            for (const char of chars) {
              buffer += char
              if (buffer.length >= 10 || char === '\n') {
                send('token', { content: buffer })
                buffer = ''
                // 小延迟让前端能跟上
                await new Promise(r => setTimeout(r, 5))
              }
            }
            if (buffer) send('token', { content: buffer })
            
            send('done', { 
              reply: finalReply, 
              iterations: iteration, 
              toolsUsed: toolCallHistory.map(t => t.tool) 
            })
            break
          } else if (iteration >= MAX_ITERATIONS) {
            finalReply = response?.content || '分析超时，请稍后重试。'
            send('done', { reply: finalReply, iterations: iteration, toolsUsed: toolCallHistory.map(t => t.tool) })
            break
          }
        }
        
        send('end', { status: '分析完成' })
        controller.close()
        
      } catch (e: any) {
        send('error', { message: e.message || '分析失败' })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    }
  })
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
