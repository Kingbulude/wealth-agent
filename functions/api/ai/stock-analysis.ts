// POST /api/ai/stock-analysis
// 智能股票分析：预获取数据 + AI 直接生成（避免 Function Calling 兼容性问题）
// Body: { query: "用户的问题", context?: "用户财务概况" }

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'
import {
  GatheredData,
  SYSTEM_PROMPT,
  MODEL_LIST,
  extractAIResponse,
  extractStockKeyword,
  getCachedCompanyInfo,
  getCachedFinancialData,
  getCachedMarketIndices,
  getCachedSearchStock,
  getCachedStockNews,
  getCachedIndustryPeers,
  getCachedStockQuote,
  buildAnalysisContext,
} from '../../lib/stock-data'

interface Env {
  AI: Ai
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const { query, context: userContext } = await context.request.json()
    if (!query?.trim()) {
      return jsonResponse({ ok: false, error: 'query required' }, 400)
    }

    // 预获取所有数据（带缓存）
    const gatheredData: GatheredData = {
      indices: null,
      stock: null,
      quote: null,
      company: null,
      financial: null,
      news: null,
      peers: null,
    }

    // 大盘指数
    const indicesResult = await getCachedMarketIndices()
    if (indicesResult.success) {
      gatheredData.indices = indicesResult.data
    }

    // 搜索股票 + 获取行情/公司/财务
    const keyword = extractStockKeyword(query)
    if (keyword) {
      const searchResult = await getCachedSearchStock(keyword, context.env.DB)
      if (searchResult.success && searchResult.data.length > 0) {
        const stock = searchResult.data[0]
        gatheredData.stock = stock

        // 并行获取行情、公司、财务、新闻
        const [quoteResult, companyResult, financialResult, newsResult] = await Promise.allSettled([
          getCachedStockQuote(stock.code),
          getCachedCompanyInfo(stock.code),
          getCachedFinancialData(stock.code),
          getCachedStockNews(stock.code, stock.name)
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
        if (newsResult.status === 'fulfilled' && newsResult.value.success) {
          gatheredData.news = newsResult.value.data
        }

        // 行业对标（依赖公司信息）
        const companyData = companyResult.status === 'fulfilled' ? companyResult.value.data : null
        if (companyData) {
          const peersResult = await getCachedIndustryPeers(
            stock.code,
            companyData.industry2 || companyData.industry || ''
          )
          if (peersResult.success) {
            gatheredData.peers = peersResult.data
          }
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

        const content = extractAIResponse(response)
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
      sources: Object.keys(gatheredData).filter(k => gatheredData[k as keyof GatheredData] !== null)
    })

  } catch (e: any) {
    console.error('[stock-analysis] 错误:', e)
    return jsonResponse({ ok: false, error: e.message || '分析失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
