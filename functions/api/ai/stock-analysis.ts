// POST /api/ai/stock-analysis
// 智能股票分析：预获取数据 + AI 直接生成（避免 Function Calling 兼容性问题）
// Body: { query: "用户的问题", context?: "用户财务概况" }

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'
import { fetchWithAntiCrawler } from '../../lib/anti-crawler'

interface Env {
  AI: Ai
  DB: D1Database
  JWT_SECRET?: string
}

const MODEL_LIST = [
  '@cf/zai-org/glm-4.7-flash',
  '@cf/qwen/qwen2.5-14b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
]

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

// ========== 数据获取函数 ==========
async function searchStock(keyword: string, db?: D1Database): Promise<any> {
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

async function getStockQuote(code: string): Promise<any> {
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

async function getMarketIndices(): Promise<any> {
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

async function getCompanyInfo(code: string): Promise<any> {
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

async function getFinancialData(code: string): Promise<any> {
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

// 生成分析上下文
function buildAnalysisContext(query: string, userContext: string, data: any): string {
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

  return context
}

const SYSTEM_PROMPT = `你是一位拥有15年经验的CFA持证人、专业股票投资分析师，擅长个股深度研究和投资决策。

## 你的任务
基于提供的实时数据，对用户的问题进行全面、专业、深入的分析。

## 分析框架
请按照以下结构输出分析：

### 一、大盘环境研判
- 当前市场整体情绪和趋势判断
- 主要指数表现解读
- 对个股的宏观影响

### 二、行业与公司分析
- 行业地位和竞争格局
- 主营业务和核心竞争力分析
- 公司治理和管理层评价

### 三、财务质量评估
- 营收和利润增长分析
- 盈利能力（毛利率、净利率等）
- 资产质量和负债水平
- 现金流健康度

### 四、估值与技术面
- 当前估值水平判断（PE/PB 历史分位）
- 短期技术面和走势分析
- 关键支撑位和压力位

### 五、风险提示
- 主要风险点（行业政策、竞争、财务等）
- 需要持续跟踪的关键指标

### 六、操作建议
- 投资评级：买入/持有/观望/卖出
- 建议仓位区间
- 止损线和目标价位
- 买入时机建议

## 重要规则
1. **所有结论必须基于提供的数据**，数据不足的部分要明确标注"数据不足，需进一步验证"
2. **每只股票必须给出明确的止损线**，这是铁律
3. 分析要客观中立，既要讲优势也要讲风险
4. 使用专业但易懂的语言，避免过于晦涩的术语
5. 数字要精确，百分比保留2位小数
6. 用 Markdown 格式输出，结构清晰层次分明

## 免责声明
分析结尾必须包含风险提示：以上分析仅为研究参考，不构成投资建议，投资有风险，入市需谨慎。`

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const { query, context: userContext } = await context.request.json()
    if (!query?.trim()) {
      return jsonResponse({ ok: false, error: 'query required' }, 400)
    }

    // 预获取所有数据
    const gatheredData: any = {
      indices: null,
      stock: null,
      quote: null,
      company: null,
      financial: null,
    }

    // 大盘指数
    const indicesResult = await getMarketIndices()
    if (indicesResult.success) {
      gatheredData.indices = indicesResult.data
    }

    // 搜索股票 + 获取行情/公司/财务
    const keyword = extractStockKeyword(query)
    if (keyword) {
      const searchResult = await searchStock(keyword, context.env.DB)
      if (searchResult.success && searchResult.data.length > 0) {
        const stock = searchResult.data[0]
        gatheredData.stock = stock

        const [quoteResult, companyResult, financialResult] = await Promise.allSettled([
          getStockQuote(stock.code),
          getCompanyInfo(stock.code),
          getFinancialData(stock.code)
        ])

        if (quoteResult.status === 'fulfilled' && quoteResult.value.success) {
          gatheredData.quote = quoteResult.value.data
        }
        if (companyResult.status === 'fulfilled' && companyResult.value.success) {
          gatheredData.company = companyResult.value.data
        }
        if (financialResult.status === 'fulfilled' && financialResult.value.success) {
          gatheredData.financial = financialResult.value.data
        }
      }
    }

    // 构建上下文
    const analysisContext = buildAnalysisContext(query, userContext || '', gatheredData)

    // 调用 AI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: analysisContext }
    ]

    let reply = ''
    for (const model of MODEL_LIST) {
      try {
        console.log(`[AI] 尝试模型: ${model}`)
        const response = await context.env.AI.run(model as any, {
          messages,
          stream: false,
          max_tokens: 4096,
        } as any)

        let content = ''
        if (typeof response === 'string') {
          content = response
        } else if (response?.response) {
          content = response.response
        } else if (response?.choices?.[0]?.message?.content) {
          content = response.choices[0].message.content
        } else if (response?.output?.text) {
          content = response.output.text
        } else {
          content = String(response)
        }

        if (content && content.trim().length > 50) {
          reply = content.trim()
          console.log(`[AI] 模型 ${model} 成功`)
          break
        }
      } catch (e: any) {
        console.warn(`[AI] 模型 ${model} 失败:`, e.message)
      }
    }

    if (!reply) {
      reply = `抱歉，AI 分析服务暂时不可用，请稍后再试。\n\n已获取的数据：`
      if (gatheredData.stock) reply += `\n- ${gatheredData.stock.name}(${gatheredData.stock.code})`
      if (gatheredData.quote) reply += `\n- 实时行情 ¥${gatheredData.quote.price.toFixed(2)}`
      reply += '\n\n请稍后重试或尝试其他问题。'
    }

    return jsonResponse({
      ok: true,
      reply,
      data: gatheredData,
      sources: Object.keys(gatheredData).filter(k => gatheredData[k] !== null)
    })

  } catch (e: any) {
    console.error('[stock-analysis] 错误:', e)
    return jsonResponse({ ok: false, error: e.message || '分析失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
