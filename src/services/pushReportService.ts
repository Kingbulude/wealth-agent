// 推送报告生成服务
// 生成持仓日报、涨跌预警、AI分析报告等格式化内容

import { Holding } from '../types/holding'

export interface PortfolioDailyReport {
  totalValue: number
  totalCost: number
  totalProfit: number
  totalProfitPercent: number
  holdings: Holding[]
  marketIndices: any[]
  timestamp: string
}

export interface PriceAlert {
  symbol: string
  name: string
  currentPrice: number
  prevClose: number
  change: number
  changePercent: number
  threshold: number
  type: 'up' | 'down'
}

// 格式化金额
function formatMoney(amount: number): string {
  if (amount >= 100000000) {
    return `¥${(amount / 100000000).toFixed(2)}亿`
  } else if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(2)}万`
  }
  return `¥${amount.toFixed(2)}`
}

// 格式化百分比
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

// 生成持仓日报内容（飞书卡片格式）
export function generateDailyReport(report: PortfolioDailyReport): string {
  const { totalValue, totalCost, totalProfit, totalProfitPercent, holdings, marketIndices, timestamp } = report

  let content = `**📊 持仓概览**\n\n`
  content += `| 指标 | 数值 |\n`
  content += `|------|------|\n`
  content += `| 持仓总值 | ${formatMoney(totalValue)} |\n`
  content += `| 持仓成本 | ${formatMoney(totalCost)} |\n`
  content += `| 持仓盈亏 | ${formatMoney(totalProfit)} |\n`
  content += `| 盈亏比例 | ${formatPercent(totalProfitPercent)} |\n\n`

  if (marketIndices && marketIndices.length > 0) {
    content += `**📈 大盘指数**\n\n`
    content += `| 指数 | 点位 | 涨跌幅 |\n`
    content += `|------|------|--------|\n`
    marketIndices.forEach(idx => {
      content += `| ${idx.name} | ${idx.price.toFixed(2)} | ${formatPercent(idx.changePercent)} |\n`
    })
    content += `\n`
  }

  content += `**🗂️ 持仓明细**\n\n`
  content += `| 股票 | 现价 | 成本 | 持仓 | 市值 | 盈亏 |\n`
  content += `|------|------|------|------|------|------|\n`
  
  const sortedHoldings = [...holdings].sort((a, b) => {
    const profitA = (a.currentPrice - a.avgCost) * a.quantity
    const profitB = (b.currentPrice - b.avgCost) * b.quantity
    return profitB - profitA
  })

  sortedHoldings.forEach(h => {
    const profit = (h.currentPrice - h.avgCost) * h.quantity
    const profitPercent = h.avgCost > 0 ? ((h.currentPrice - h.avgCost) / h.avgCost) * 100 : 0
    const marketValue = h.currentPrice * h.quantity
    
    content += `| ${h.name}(${h.symbol}) | ¥${h.currentPrice.toFixed(2)} | ¥${h.avgCost.toFixed(2)} | ${h.quantity}股 | ${formatMoney(marketValue)} | ${formatMoney(profit)}(${formatPercent(profitPercent)}) |\n`
  })

  content += `\n---\n`
  content += `⏰ 更新时间：${new Date(timestamp).toLocaleString('zh-CN')}`

  return content
}

// 生成涨跌预警内容
export function generatePriceAlert(alerts: PriceAlert[]): string {
  if (alerts.length === 0) {
    return '暂无涨跌预警'
  }

  let content = `**🚨 涨跌预警通知**\n\n`
  
  alerts.forEach(alert => {
    const direction = alert.type === 'up' ? '📈 上涨' : '📉 下跌'
    content += `${direction}超过 ${formatPercent(alert.threshold)}：\n`
    content += `**${alert.name}(${alert.symbol})**\n`
    content += `现价：¥${alert.currentPrice.toFixed(2)}\n`
    content += `涨跌：${formatMoney(alert.change)} (${formatPercent(alert.changePercent)})\n\n`
  })

  content += `---\n`
  content += `⏰ 时间：${new Date().toLocaleString('zh-CN')}`

  return content
}

// 生成 AI 分析报告推送内容
export function generateAIReport(stockCode: string, stockName: string, analysis: string): string {
  return `**🤖 AI 投资分析报告**\n\n` +
    `**标的：${stockName}(${stockCode})**\n\n` +
    `---\n\n` +
    analysis +
    `\n\n---\n` +
    `⏰ 生成时间：${new Date().toLocaleString('zh-CN')}`
}

// 检测涨跌预警
export function detectPriceAlerts(holdings: Holding[], threshold: number = 5): PriceAlert[] {
  const alerts: PriceAlert[] = []

  holdings.forEach(h => {
    if (!h.currentPrice || !h.prevClose || h.prevClose <= 0) return

    const change = h.currentPrice - h.prevClose
    const changePercent = (change / h.prevClose) * 100
    const absPercent = Math.abs(changePercent)

    if (absPercent >= threshold) {
      alerts.push({
        symbol: h.symbol,
        name: h.name,
        currentPrice: h.currentPrice,
        prevClose: h.prevClose,
        change,
        changePercent,
        threshold,
        type: change >= 0 ? 'up' : 'down'
      })
    }
  })

  return alerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
}

// 计算持仓汇总
export function calculatePortfolioSummary(holdings: Holding[]): {
  totalValue: number
  totalCost: number
  totalProfit: number
  totalProfitPercent: number
} {
  let totalValue = 0
  let totalCost = 0

  holdings.forEach(h => {
    const marketValue = h.currentPrice * h.quantity
    const costValue = h.avgCost * h.quantity
    totalValue += marketValue
    totalCost += costValue
  })

  const totalProfit = totalValue - totalCost
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

  return { totalValue, totalCost, totalProfit, totalProfitPercent }
}
