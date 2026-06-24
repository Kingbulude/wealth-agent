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

// ==================== 快捷场景模板 ====================
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

// ==================== 专业分析场景模板 ====================
export interface ProScenarioTemplate {
  key: string
  title: string
  description: string
  icon: string
  category: string
  prompt: string
  structured: boolean
}

export const PRO_SCENARIO_TEMPLATES: ProScenarioTemplate[] = [
  {
    key: 'asset_allocation_checkup',
    title: '资产配置体检',
    description: '检查资产类别分布是否合理',
    icon: '📊',
    category: '配置分析',
    structured: true,
    prompt: `请对我的资产配置进行全面体检，基于我的实际资产和持仓数据，输出结构化分析报告。

要求按以下结构输出：

## 一、配置现状概览
- 各大类资产（现金/权益/固收/房产/其他）占比
- 与标准配置模型的对比偏差

## 二、核心发现
列出 3-5 条关键发现，每条标注是「优势」还是「问题」

## 三、数据引用
引用具体数据支撑结论，例如：
- 权益类占比 XX%，高于建议区间 XX%-XX%
- 现金储备仅 XX 元，不足 3 个月支出

## 四、优化建议
给出 3-5 条具体可执行的调整建议`
  },
  {
    key: 'risk_assessment',
    title: '风险评估',
    description: '评估持仓风险等级和集中度',
    icon: '⚠️',
    category: '风险分析',
    structured: true,
    prompt: `请对我的投资组合进行全面风险评估，基于我的实际持仓数据，输出结构化风险分析报告。

要求按以下结构输出：

## 一、风险等级评定
- 整体风险等级（低/中低/中/中高/高）
- 评定依据简述

## 二、集中度风险
- 单只持仓最高占比
- 前三大持仓合计占比
- 行业集中度分析（最高行业占比）

## 三、风险点清单
列出 3-5 个主要风险点，按严重程度排序

## 四、数据引用
引用具体持仓数据支撑风险判断

## 五、风险管理建议
给出 3-5 条具体的风险对冲或分散建议`
  },
  {
    key: 'portfolio_optimization',
    title: '组合优化建议',
    description: '给出具体的调仓建议',
    icon: '🎯',
    category: '优化建议',
    structured: true,
    prompt: `请基于我的当前持仓和资产状况，给出一份具体的组合优化建议方案，输出结构化报告。

要求按以下结构输出：

## 一、优化目标
基于我的现状，明确 2-3 个优化目标

## 二、当前组合诊断
- 优势分析（2-3 条）
- 问题诊断（2-3 条）

## 三、具体调仓建议
分「买入」「卖出」「持有」三类列出具体操作建议，包含：
- 标的名称/代码
- 建议操作方向
- 建议调整比例或金额

## 四、预期效果
优化后组合的预期变化（风险、收益、分散度等）

## 五、数据引用
引用我的持仓数据作为决策依据

## 六、执行节奏
建议的调仓步骤和时间安排`
  },
  {
    key: 'concentration_analysis',
    title: '持仓集中度分析',
    description: '分析单只/行业占比',
    icon: '🔍',
    category: '持仓分析',
    structured: true,
    prompt: `请对我的持仓进行集中度分析，基于实际持仓数据，输出结构化分析报告。

要求按以下结构输出：

## 一、单只集中度
- 持仓数量统计
- 第一大持仓占比（名称 + 占比）
- 前三大持仓合计占比
- 前五大持仓合计占比

## 二、行业集中度
- 各行业持仓占比排名
- 最高行业占比
- 行业数量（分散度）

## 三、集中度评分
- 单只集中度评分（1-10分，10分最集中）
- 行业集中度评分（1-10分）
- 综合集中度评级

## 四、风险提示
集中度可能带来的风险点（2-3条）

## 五、数据引用
列出具体持仓占比数据表格

## 六、分散化建议
给出具体的分散化调整建议`
  },
  {
    key: 'return_attribution',
    title: '收益归因分析',
    description: '分析盈亏来源',
    icon: '📈',
    category: '收益分析',
    structured: true,
    prompt: `请对我的持仓收益进行归因分析，基于实际持仓的盈亏数据，输出结构化分析报告。

要求按以下结构输出：

## 一、收益概览
- 总盈亏金额和收益率
- 盈利持仓数量 vs 亏损持仓数量
- 盈亏比

## 二、盈利贡献 Top 3
- 贡献最大的 3 只持仓
- 每只的盈亏金额和贡献占比

## 三、亏损拖累 Top 3
- 亏损最多的 3 只持仓
- 每只的亏损金额和拖累程度

## 四、行业收益归因
- 各行业盈亏贡献排名
- 最强/最弱行业

## 五、数据引用
引用具体持仓的盈亏数据

## 六、操作建议
基于收益归因给出 3-5 条操作建议`
  },
  {
    key: 'industry_distribution',
    title: '行业分布洞察',
    description: '行业分布是否均衡',
    icon: '🏭',
    category: '配置分析',
    structured: true,
    prompt: `请对我的持仓进行行业分布分析，基于实际持仓数据（请根据股票名称/代码合理推断所属行业），输出结构化分析报告。

要求按以下结构输出：

## 一、行业分布概览
- 覆盖行业数量
- 行业分布均匀度评估
- 第一大行业占比

## 二、各行业占比明细
按占比从高到低列出各行业及持仓占比

## 三、均衡度评估
- 行业集中度 CR3（前三大行业合计占比）
- 赫芬达尔指数（HHI）或类似分散度指标
- 均衡度评级（优秀/良好/一般/较差）

## 四、行业机会与风险
- 超配行业的风险提示（2-3条）
- 低配或缺失行业的机会提示（2-3条）

## 五、数据引用
列出各行业的具体持仓标的和占比数据

## 六、调整建议
给出 3-5 条行业配置优化建议`
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
