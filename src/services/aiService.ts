import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAuthStore } from '../renderer/stores/authStore'
import { WealthCalculator } from '../utils/wealthCalculator'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  ts?: number
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

const HAS_API_PROXY = typeof window !== 'undefined' && /pages\.dev$/.test(window.location.hostname)

function getUserEmail(): string {
  return useAuthStore.getState().user?.email || ''
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
      ...(options.headers || {})
    }
  })
}

// ==================== 上下文构建（优先从 portfolioStore 读实时数据）====================
function buildFinancialContext(): string {
  // 优先用 portfolioStore（实时行情+已计算好的汇总）
  const { portfolioStore } = (() => {
    try {
      const { usePortfolioStore } = require('../stores/portfolioStore')
      return { portfolioStore: usePortfolioStore.getState() }
    } catch { return { portfolioStore: null } }
  })()

  // 有实时数据时用 portfolioStore
  if (portfolioStore?.data) {
    const d = portfolioStore.data
    const s = d.summary
    let ctx = '## 用户财务概况（实时数据）\n\n'
    ctx += `### 持仓汇总\n`
    ctx += `- 总市值：¥${(s.totalMarketValue || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}\n`
    ctx += `- 总成本：¥${(s.totalCost || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}\n`
    ctx += `- 总浮动盈亏：¥${(s.totalProfit || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}（${(s.totalProfitPercent || 0) >= 0 ? '+' : ''}${(s.totalProfitPercent || 0).toFixed(2)}%）\n`
    ctx += `- 股票：${s.stockCount} 只\n`
    ctx += `- 基金：${s.fundCount} 只\n`
    ctx += `- 数据更新时间：${s.updateTime || '-'}\n\n`

    if (d.byType?.stock?.holdings?.length > 0) {
      ctx += `### 股票持仓（${d.byType.stock.holdings.length} 只）\n`
      for (const h of d.byType.stock.holdings) {
        const profitSign = h.profit >= 0 ? '+' : ''
        ctx += `- ${h.name}(${h.symbol}) ${h.quantity}股\n`
        ctx += `  成本价 ¥${h.avgCost.toFixed(2)} → 当前价 ¥${h.currentPrice.toFixed(2)}\n`
        ctx += `  市值 ¥${h.marketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} | 盈亏 ${profitSign}¥${h.profit.toFixed(2)}（${profitSign}${h.profitPercent.toFixed(2)}%）\n`
      }
      ctx += '\n'
    }

    if (d.byType?.fund?.holdings?.length > 0) {
      ctx += `### 基金持仓（${d.byType.fund.holdings.length} 只）\n`
      for (const h of d.byType.fund.holdings) {
        const profitSign = h.profit >= 0 ? '+' : ''
        ctx += `- ${h.name}(${h.symbol}) ${h.quantity}份\n`
        ctx += `  成本 ¥${h.cost.toFixed(2)} → 市值 ¥${h.marketValue.toFixed(2)} | ${profitSign}¥${h.profit.toFixed(2)}（${profitSign}${h.profitPercent.toFixed(2)}%）\n`
      }
      ctx += '\n'
    }

    // 再补充静态资产
    try {
      const { useAssetStore } = require('../stores/assetStore')
      const assets = useAssetStore.getState().assets
      if (assets.length > 0) {
        ctx += `### 其他资产（手动录入）\n`
        const byCategory: Record<string, number> = {}
        for (const a of assets) {
          byCategory[a.category] = (byCategory[a.category] || 0) + a.amount
        }
        for (const [cat, amount] of Object.entries(byCategory)) {
          ctx += `- ${cat}: ¥${amount.toLocaleString()}\n`
        }
      }
    } catch {}

    return ctx
  }

  // 降级：从 holdingStore + assetStore 读（无实时行情时）
  const { assets } = useAssetStore.getState()
  const { holdings, getTotalValue, getTotalProfit, getProfitRate } = useHoldingStore.getState()

  const summary = WealthCalculator.calculateSummary(assets)
  const stockHoldings = holdings.filter(h => h.type === 'stock')
  const fundHoldings = holdings.filter(h => h.type === 'fund')

  let ctx = '## 用户财务概况\n\n'
  ctx += `### 总览\n`
  ctx += `- 总资产：¥${summary.totalAssets.toLocaleString()}\n`
  ctx += `- 总负债：¥${summary.totalLiabilities.toLocaleString()}\n`
  ctx += `- 净资产：¥${summary.totalNetWorth.toLocaleString()}\n`
  ctx += `- 持仓市值：¥${getTotalValue().toLocaleString()}\n`
  ctx += `- 浮动盈亏：¥${getTotalProfit().toFixed(2)}（${getProfitRate().toFixed(2)}%）\n\n`

  if (stockHoldings.length > 0) {
    ctx += `### 股票持仓（${stockHoldings.length} 只）\n`
    for (const h of stockHoldings) {
      const profit = (h.currentPrice - h.avgCost) * h.quantity
      const rate = h.avgCost > 0 ? ((h.currentPrice - h.avgCost) / h.avgCost * 100) : 0
      ctx += `- ${h.name}(${h.symbol}) ${h.quantity}股 @¥${h.avgCost.toFixed(2)} → ¥${h.currentPrice.toFixed(2)} ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}(${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%)\n`
    }
    ctx += '\n'
  }

  if (fundHoldings.length > 0) {
    ctx += `### 基金持仓（${fundHoldings.length} 只）\n`
    for (const h of fundHoldings) {
      ctx += `- ${h.name}(${h.symbol}) ${h.quantity}份 @¥${h.avgCost.toFixed(4)} → ¥${h.currentPrice.toFixed(4)}\n`
    }
    ctx += '\n'
  }

  if (assets.length > 0) {
    ctx += `### 其他资产\n`
    const byCategory: Record<string, number> = {}
    for (const a of assets) {
      byCategory[a.category] = (byCategory[a.category] || 0) + a.amount
    }
    for (const [cat, amount] of Object.entries(byCategory)) {
      ctx += `- ${cat}: ¥${amount.toLocaleString()}\n`
    }
  }

  return ctx
}

// ==================== 场景模板 ====================
export const SCENARIO_TEMPLATES = [
  {
    key: 'portfolio_review',
    title: '📊 投资组合体检',
    prompt: '请基于我的当前持仓，分析我的投资组合是否合理？有哪些可以优化的地方？'
  },
  {
    key: 'risk_analysis',
    title: '⚠️ 风险分析',
    prompt: '请分析我当前持仓的潜在风险，包括集中度、行业暴露、波动率等。'
  },
  {
    key: 'allocation',
    title: '💡 资产配置建议',
    prompt: '基于我的净资产规模和当前配置，请给我一个优化的资产配置建议。'
  },
  {
    key: 'dca',
    title: '🎯 定投建议',
    prompt: '我想开始基金定投，每月可投 ¥5000，请给我一个适合我的定投组合建议。'
  },
  {
    key: 'rebalance',
    title: '⚖️ 再平衡方案',
    prompt: '我的持仓已经偏离了最初的计划，请帮我设计一个再平衡方案。'
  },
  {
    key: 'tax',
    title: '💰 节税策略',
    prompt: '在当前 A 股环境下，如何通过合理的买卖时机和持仓时长优化税务？'
  }
]

// ==================== 历史持久化 ====================
const HISTORY_KEY_PREFIX = 'wealth_agent_ai_history'

function getLocalHistory(): ChatSession[] {
  try {
    const uid = useAuthStore.getState().user?.id || ''
    return JSON.parse(localStorage.getItem(`${HISTORY_KEY_PREFIX}:${uid}`) || '[]')
  } catch { return [] }
}

function saveLocalHistory(sessions: ChatSession[]) {
  try {
    const uid = useAuthStore.getState().user?.id || ''
    localStorage.setItem(`${HISTORY_KEY_PREFIX}:${uid}`, JSON.stringify(sessions))
  } catch {}
}

async function loadHistoryFromApi(): Promise<ChatSession[] | null> {
  try {
    const resp = await apiFetch('/preferences/ai_history')
    if (resp.ok) {
      const j = await resp.json()
      if (j.ok && j.data?.value) {
        saveLocalHistory(j.data.value)
        return j.data.value
      }
    }
  } catch (e) {
    console.warn('加载 AI 历史失败:', e)
  }
  return null
}

async function saveHistoryToApi(sessions: ChatSession[]) {
  try {
    await apiFetch('/preferences/ai_history', {
      method: 'PUT',
      body: JSON.stringify({ value: sessions })
    })
  } catch (e) {
    console.warn('保存 AI 历史失败:', e)
  }
}

// ==================== 对话主函数 ====================
export async function chat(
  messages: ChatMessage[],
  options: { sessionId?: string; context?: string } = {}
): Promise<{ reply: string; sessionId: string }> {
  if (!HAS_API_PROXY) {
    return { reply: mockReply(messages[messages.length - 1]?.content || ''), sessionId: options.sessionId || '' }
  }

  try {
    const context = options.context ?? buildFinancialContext()
    const resp = await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, context })
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return { reply: `⚠️ AI 服务异常：${err.error || resp.statusText}`, sessionId: options.sessionId || '' }
    }

    const json = await resp.json()
    return { reply: json.data?.reply || '（AI 无回复）', sessionId: options.sessionId || '' }
  } catch (e: any) {
    return { reply: `⚠️ 调用失败：${e.message || e}`, sessionId: options.sessionId || '' }
  }
}

// 离线降级回复
function mockReply(question: string): string {
  return `📊 现状分析：根据你的账户数据看，已识别持仓与资产。\n\n⚠️ 风险提示：建议保持资产分散，避免单一行业过度集中。\n\n💡 优化建议：\n1. 保持应急资金 3-6 个月支出\n2. 权益类（股票+基金）占比建议 30-60%\n3. 定期检视并再平衡\n\n🎯 行动计划：\n- 本月内完成一次持仓体检\n- 设定止盈止损规则\n\n（注：当前为离线模拟回复，配置 AI 服务后可获得真实建议）`
}

export { buildFinancialContext, loadHistoryFromApi, saveHistoryToApi, getLocalHistory, saveLocalHistory }
