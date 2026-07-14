// GET /api/ai/stock-analysis-stream
// SSE 流式股票分析：预获取数据 + 直接 AI 生成（避免 Function Calling 兼容性问题）
// Query: ?query=xxx&context=xxx

import { getAuthUser, optionsResponse, requireAuth } from '../../lib/auth'
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

const TOOL_LABELS: Record<string, string> = {
  search_stock: '搜索股票',
  get_stock_quote: '获取行情',
  get_financial_data: '获取财务数据',
  get_company_info: '获取公司信息',
  get_market_indices: '获取大盘指数',
  search_news: '搜索新闻',
  get_industry_peers: '获取行业对标'
}

function sseFormat(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(sseFormat(event, data)))
      }

      try {
        send('start', { status: '开始分析...' })

        const gatheredData: GatheredData = {
          indices: null,
          stock: null,
          quote: null,
          company: null,
          financial: null,
          news: null,
          peers: null,
        }
        let toolCount = 0

        // 1. 获取大盘指数（带缓存）
        send('tool_start', { tool: 'get_market_indices', label: '🔍 获取大盘指数...', status: 'running' })
        const indicesResult = await getCachedMarketIndices()
        toolCount++
        if (indicesResult.success) {
          gatheredData.indices = indicesResult.data
          send('tool_end', {
            tool: 'get_market_indices',
            label: '✅ 大盘指数已获取',
            status: 'completed',
            data: indicesResult.data
          })
        } else {
          send('tool_end', { tool: 'get_market_indices', label: '⚠️ 大盘指数获取失败', status: 'error' })
        }

        // 2. 提取关键词并搜索股票
        const keyword = extractStockKeyword(query)
        if (keyword) {
          send('tool_start', { tool: 'search_stock', label: '🔍 搜索股票...', status: 'running' })
          const searchResult = await getCachedSearchStock(keyword, context.env.DB)
          toolCount++
          if (searchResult.success && searchResult.data.length > 0) {
            const stock = searchResult.data[0]
            gatheredData.stock = stock
            send('tool_end', {
              tool: 'search_stock',
              label: `✅ 已找到 ${stock.name}`,
              status: 'completed',
              data: stock
            })

            // 3. 获取行情
            send('tool_start', { tool: 'get_stock_quote', label: `📊 获取 ${stock.name} 行情...`, status: 'running' })
            const quoteResult = await getCachedStockQuote(stock.code)
            toolCount++
            if (quoteResult.success) {
              gatheredData.quote = quoteResult.data
              const q = quoteResult.data
              send('tool_end', {
                tool: 'get_stock_quote',
                label: `✅ 行情 ¥${q.price.toFixed(2)}`,
                status: 'completed',
                data: q
              })
            } else {
              send('tool_end', { tool: 'get_stock_quote', label: '⚠️ 行情获取失败', status: 'error' })
            }

            // 4. 获取公司信息
            send('tool_start', { tool: 'get_company_info', label: `🏢 获取公司信息...`, status: 'running' })
            const companyResult = await getCachedCompanyInfo(stock.code)
            toolCount++
            if (companyResult.success) {
              gatheredData.company = companyResult.data
              const c = companyResult.data
              send('tool_end', {
                tool: 'get_company_info',
                label: `✅ ${c.industry2 || '公司信息已获取'}`,
                status: 'completed',
                data: c
              })
            } else {
              send('tool_end', { tool: 'get_company_info', label: '⚠️ 公司信息获取失败', status: 'error' })
            }

            // 5. 获取财务数据
            send('tool_start', { tool: 'get_financial_data', label: `💰 获取财务数据...`, status: 'running' })
            const financialResult = await getCachedFinancialData(stock.code)
            toolCount++
            if (financialResult.success) {
              gatheredData.financial = financialResult.data
              send('tool_end', {
                tool: 'get_financial_data',
                label: `✅ 财务数据已获取`,
                status: 'completed',
                data: financialResult.data
              })
            } else {
              send('tool_end', { tool: 'get_financial_data', label: '⚠️ 财务数据获取失败', status: 'error' })
            }

            // 6. 获取新闻动态
            send('tool_start', { tool: 'search_news', label: `📰 获取 ${stock.name} 新闻...`, status: 'running' })
            const newsResult = await getCachedStockNews(stock.code, stock.name)
            toolCount++
            if (newsResult.success) {
              gatheredData.news = newsResult.data
              send('tool_end', {
                tool: 'search_news',
                label: `✅ 新闻已获取 ${newsResult.data.length}条`,
                status: 'completed',
                data: newsResult.data
              })
            } else {
              send('tool_end', { tool: 'search_news', label: '⚠️ 新闻获取失败', status: 'error' })
            }

            // 7. 获取行业对标
            if (gatheredData.company) {
              const industry = gatheredData.company.industry2 || gatheredData.company.industry || ''
              send('tool_start', { tool: 'get_industry_peers', label: `🏢 获取行业对标...`, status: 'running' })
              const peersResult = await getCachedIndustryPeers(stock.code, industry)
              toolCount++
              if (peersResult.success) {
                gatheredData.peers = peersResult.data
                send('tool_end', {
                  tool: 'get_industry_peers',
                  label: `✅ 行业对标已获取 ${peersResult.data.length}家`,
                  status: 'completed',
                  data: peersResult.data
                })
              } else {
                send('tool_end', { tool: 'get_industry_peers', label: '⚠️ 行业对标获取失败', status: 'error' })
              }
            }
          } else {
            send('tool_end', { tool: 'search_stock', label: '⚠️ 未找到股票', status: 'error' })
          }
        }

        // 构建完整分析上下文
        const analysisContext = buildAnalysisContext(query, userContext, gatheredData)

        // 调用 AI 生成分析
        send('start', { status: '🤔 正在深度分析...' })

        const messages = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: analysisContext }
        ]

        // 尝试多个模型
        let finalReply = ''
        let aiSuccess = false

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
              finalReply = content.trim()
              aiSuccess = true
              console.log(`[AI] 模型 ${model} 成功，输出长度: ${finalReply.length}`)
              break
            }
          } catch (e: any) {
            console.warn(`[AI] 模型 ${model} 失败:`, e.message)
          }
        }

        if (!aiSuccess || !finalReply) {
          finalReply = `抱歉，AI 分析服务暂时不可用，请稍后再试。\n\n已获取的数据工具调用 ${toolCount} 次，包括：`
          if (gatheredData.stock) finalReply += `\n- ${gatheredData.stock.name}(${gatheredData.stock.code})`
          if (gatheredData.quote) finalReply += `\n- 实时行情 ¥${gatheredData.quote.price.toFixed(2)}`
          finalReply += '\n\n请稍后重试或尝试其他问题。'
        }

        // 流式输出
        send('token_start', { status: '开始输出分析结果...' })

        const chars = finalReply.split('')
        let buffer = ''
        for (let i = 0; i < chars.length; i++) {
          buffer += chars[i]
          if (buffer.length >= 8 || chars[i] === '\n') {
            send('token', { content: buffer })
            buffer = ''
            // 延迟让前端能跟上
            if (i % 40 === 0) {
              await new Promise(r => setTimeout(r, 20))
            }
          }
        }
        if (buffer) send('token', { content: buffer })

        send('done', {
          reply: finalReply,
          toolsUsed: toolCount
        })

        send('end', { status: '分析完成' })
        controller.close()

      } catch (e: any) {
        console.error('[stream] 错误:', e)
        send('error', { message: e.message || '分析失败，请稍后重试' })
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
