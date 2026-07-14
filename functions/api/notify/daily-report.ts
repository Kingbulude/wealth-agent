// POST /api/notify/daily-report
// 生成并推送持仓日报

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'
import { getCachedMarketIndices, getCachedStockQuote } from '../../lib/stock-data'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

interface HoldingRecord {
  id: string
  user_id: string
  symbol: string
  name: string
  quantity: number
  avg_cost: number
  current_price: number
  prev_close: number
  type: 'stock' | 'fund'
  currency: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    // 1. 获取用户持仓
    const { results } = await context.env.DB.prepare(
      `SELECT id, user_id, symbol, name, quantity, avg_cost, current_price, prev_close, type, currency
       FROM holdings WHERE user_id = ?`
    ).bind(user.id).all()

    const holdings: HoldingRecord[] = (results || []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      symbol: r.symbol,
      name: r.name,
      quantity: r.quantity,
      avg_cost: r.avg_cost,
      current_price: r.current_price,
      prev_close: r.prev_close,
      type: r.type,
      currency: r.currency
    }))

    if (holdings.length === 0) {
      return jsonResponse({ ok: false, error: '暂无持仓数据' }, 400)
    }

    // 2. 刷新最新行情（对当前价格为0或数据较旧的持仓）
    const stocksToRefresh = holdings
      .filter(h => !h.current_price || h.current_price <= 0)
      .map(h => h.symbol)

    if (stocksToRefresh.length > 0) {
      await Promise.all(stocksToRefresh.map(async symbol => {
        const result = await getCachedStockQuote(symbol)
        if (result.success && result.data) {
          await context.env.DB.prepare(
            `UPDATE holdings SET current_price = ?, prev_close = ?, updated_at = ? WHERE symbol = ? AND user_id = ?`
          ).bind(result.data.price, result.data.prevClose, new Date().toISOString(), symbol, user.id).run()
        }
      }))

      // 重新获取更新后的持仓
      const refreshed = await context.env.DB.prepare(
        `SELECT id, user_id, symbol, name, quantity, avg_cost, current_price, prev_close, type, currency
         FROM holdings WHERE user_id = ?`
      ).bind(user.id).all()
      refreshed.results.forEach((r: any, i: number) => {
        if (holdings[i]) {
          holdings[i].current_price = r.current_price
          holdings[i].prev_close = r.prev_close
        }
      })
    }

    // 3. 获取大盘指数
    const indicesResult = await getCachedMarketIndices()
    const marketIndices = indicesResult.success ? indicesResult.data : []

    // 4. 计算汇总
    let totalValue = 0
    let totalCost = 0

    holdings.forEach(h => {
      const price = h.current_price || h.avg_cost || 0
      totalValue += price * h.quantity
      totalCost += h.avg_cost * h.quantity
    })

    const totalProfit = totalValue - totalCost
    const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

    // 5. 生成日报内容
    function formatMoney(amount: number): string {
      if (amount >= 100000000) return `¥${(amount / 100000000).toFixed(2)}亿`
      if (amount >= 10000) return `¥${(amount / 10000).toFixed(2)}万`
      return `¥${amount.toFixed(2)}`
    }

    function formatPercent(value: number): string {
      const sign = value >= 0 ? '+' : ''
      return `${sign}${value.toFixed(2)}%`
    }

    let content = `**📊 持仓概览**\n\n`
    content += `| 指标 | 数值 |\n|------|------|\n`
    content += `| 持仓总值 | ${formatMoney(totalValue)} |\n`
    content += `| 持仓成本 | ${formatMoney(totalCost)} |\n`
    content += `| 持仓盈亏 | ${formatMoney(totalProfit)} |\n`
    content += `| 盈亏比例 | ${formatPercent(totalProfitPercent)} |\n\n`

    if (marketIndices.length > 0) {
      content += `**📈 大盘指数**\n\n`
      content += `| 指数 | 点位 | 涨跌幅 |\n|------|------|--------|\n`
      marketIndices.forEach(idx => {
        content += `| ${idx.name} | ${idx.price.toFixed(2)} | ${formatPercent(idx.changePercent)} |\n`
      })
      content += `\n`
    }

    content += `**🗂️ 持仓明细**\n\n`
    content += `| 股票 | 现价 | 成本 | 持仓 | 市值 | 盈亏 |\n`
    content += `|------|------|------|------|------|------|\n`

    holdings.forEach(h => {
      const price = h.current_price || h.avg_cost || 0
      const profit = (price - h.avg_cost) * h.quantity
      const profitPercent = h.avg_cost > 0 ? ((price - h.avg_cost) / h.avg_cost) * 100 : 0
      const marketValue = price * h.quantity

      content += `| ${h.name}(${h.symbol}) | ¥${price.toFixed(2)} | ¥${h.avg_cost.toFixed(2)} | ${h.quantity}股 | ${formatMoney(marketValue)} | ${formatMoney(profit)}(${formatPercent(profitPercent)}) |\n`
    })

    content += `\n---\n⏰ 更新时间：${new Date().toLocaleString('zh-CN')}`

    // 6. 获取用户飞书配置
    const prefResult = await context.env.DB.prepare(
      `SELECT value FROM preferences WHERE user_email = ? AND key = ?`
    ).bind(user.email, 'push_config').first()

    let webhookUrl = ''
    if (prefResult && prefResult.value) {
      try {
        const config = JSON.parse(prefResult.value)
        webhookUrl = config.feishuWebhook || ''
      } catch {
        webhookUrl = prefResult.value
      }
    }

    if (!webhookUrl) {
      return jsonResponse({ ok: false, error: '未配置飞书Webhook' }, 400)
    }

    // 7. 发送飞书推送
    const cardMessage = {
      msg_type: 'interactive',
      card: {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: `持仓日报 ${new Date().toLocaleDateString('zh-CN')}` },
          template: totalProfit >= 0 ? 'green' : 'red'
        },
        elements: [
          { tag: 'div', text: { tag: 'lark_md', content } },
          { tag: 'note', elements: [{ tag: 'plain_text', content: '来自 财富管理智能体 · 不构成投资建议' }] }
        ]
      }
    }

    const pushResp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardMessage)
    })

    if (!pushResp.ok) {
      const text = await pushResp.text()
      return jsonResponse({ ok: false, error: `推送失败: ${text}` }, 502)
    }

    const pushResult = await pushResp.json()
    if (pushResult.code !== 0) {
      return jsonResponse({ ok: false, error: `飞书错误: ${pushResult.msg || pushResult.code}` }, 502)
    }

    return jsonResponse({ ok: true, message: '日报推送成功' })

  } catch (e: any) {
    console.error('[daily-report] 错误:', e)
    return jsonResponse({ ok: false, error: e.message || '生成日报失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
