import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAuthStore } from '../renderer/stores/authStore'
import { WealthCalculator } from '../utils/wealthCalculator'
import { fetchStockPrice, searchSecurities, fetchIndexQuotes, type StockData } from './stockService'

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
  // 获取当前用户信息，用于数据过滤（防止串号）
  const currentUserId = useAuthStore.getState().user?.id || ''
  const currentUserEmail = useAuthStore.getState().user?.email || ''
  
  function filterByUser<T extends { userId?: string; userEmail?: string }>(items: T[]): T[] {
    return items.filter(h => {
      if (h.userId && currentUserId) return h.userId === currentUserId
      if (h.userEmail && currentUserEmail) return h.userEmail === currentUserEmail
      return !h.userId && !h.userEmail && !currentUserId && !currentUserEmail
    })
  }
  
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
    // 过滤当前用户的持仓
    const stockHoldings = filterByUser(d.byType?.stock?.holdings || [])
    const fundHoldings = filterByUser(d.byType?.fund?.holdings || [])
    const s = d.summary
    
    let ctx = '## 用户财务概况（实时数据）\n\n'
    ctx += `### 持仓汇总\n`
    ctx += `- 股票：${stockHoldings.length} 只\n`
    ctx += `- 基金：${fundHoldings.length} 只\n`
    ctx += `- 数据更新时间：${s.updateTime || '-'}\n\n`

    if (stockHoldings.length > 0) {
      ctx += `### 股票持仓（${stockHoldings.length} 只）\n`
      for (const h of stockHoldings) {
        const profitSign = h.profit >= 0 ? '+' : ''
        ctx += `- ${h.name}(${h.symbol}) ${h.quantity}股\n`
        ctx += `  成本价 ¥${h.avgCost.toFixed(2)} → 当前价 ¥${h.currentPrice.toFixed(2)}\n`
        ctx += `  市值 ¥${h.marketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} | 盈亏 ${profitSign}¥${h.profit.toFixed(2)}（${profitSign}${h.profitPercent.toFixed(2)}%）\n`
      }
      ctx += '\n'
    }

    if (fundHoldings.length > 0) {
      ctx += `### 基金持仓（${fundHoldings.length} 只）\n`
      for (const h of fundHoldings) {
        const profitSign = h.profit >= 0 ? '+' : ''
        ctx += `- ${h.name}(${h.symbol}) ${h.quantity}份\n`
        ctx += `  成本 ¥${h.cost.toFixed(2)} → 市值 ¥${h.marketValue.toFixed(2)} | ${profitSign}¥${h.profit.toFixed(2)}（${profitSign}${h.profitPercent.toFixed(2)}%）\n`
      }
      ctx += '\n'
    }

    // 再补充静态资产（也过滤用户）
    try {
      const { useAssetStore } = require('../stores/assetStore')
      const allAssets = useAssetStore.getState().assets
      const assets = filterByUser(allAssets)
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
  const allAssets = useAssetStore.getState().assets
  const allHoldings = useHoldingStore.getState().holdings
  const assets = filterByUser(allAssets)
  const holdings = filterByUser(allHoldings)

  const summary = WealthCalculator.calculateSummary(assets)
  const stockHoldings = holdings.filter(h => h.type === 'stock')
  const fundHoldings = holdings.filter(h => h.type === 'fund')
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentPrice || 0) * (h.quantity || 0), 0)
  const totalCost = holdings.reduce((sum, h) => sum + (h.avgCost || 0) * (h.quantity || 0), 0)
  const totalProfit = totalValue - totalCost
  const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

  let ctx = '## 用户财务概况\n\n'
  ctx += `### 总览\n`
  ctx += `- 总资产：¥${summary.totalAssets.toLocaleString()}\n`
  ctx += `- 总负债：¥${summary.totalLiabilities.toLocaleString()}\n`
  ctx += `- 净资产：¥${summary.totalNetWorth.toLocaleString()}\n`
  ctx += `- 持仓市值：¥${totalValue.toLocaleString()}\n`
  ctx += `- 浮动盈亏：¥${totalProfit.toFixed(2)}（${profitRate.toFixed(2)}%）\n\n`

  if (stockHoldings.length > 0) {
    ctx += `### 股票持仓（${stockHoldings.length} 只）\n`
    for (const h of stockHoldings) {
      const profit = ((h.currentPrice || 0) - (h.avgCost || 0)) * (h.quantity || 0)
      const rate = (h.avgCost || 0) > 0 ? (((h.currentPrice || 0) - (h.avgCost || 0)) / (h.avgCost || 0)) * 100 : 0
      ctx += `- ${h.name}(${h.symbol || h.code}) ${h.quantity}股 @¥${(h.avgCost || 0).toFixed(2)} → ¥${(h.currentPrice || 0).toFixed(2)} ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}(${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%)\n`
    }
    ctx += '\n'
  }

  if (fundHoldings.length > 0) {
    ctx += `### 基金持仓（${fundHoldings.length} 只）\n`
    for (const h of fundHoldings) {
      ctx += `- ${h.name}(${h.symbol || h.code}) ${h.quantity}份 @¥${(h.avgCost || 0).toFixed(4)} → ¥${(h.currentPrice || 0).toFixed(4)}\n`
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
    key: 'stock_deep_analysis',
    title: '个股深度分析',
    description: '分析指定股票的完整投研报告',
    icon: '📈',
    category: '股票分析',
    structured: true,
    prompt: `请对以下股票进行完整的深度分析，严格按照八模块输出格式：

**分析对象**：用户指定的股票（请在对话中确认具体股票代码/名称）

**分析框架**：
1. **一句话结论**：四类结论之一（重点关注/跟踪观察/谨慎观望/暂不推荐）+ 是否可入场 + 置信度
2. **行业景气度与资金流向**：行业热度、行业阶段、资金流向、综合判定
3. **个股定位**：赛道地位、盈利确定性、筹码/估值位置
4. **未来2-3个月催化事件**：业绩催化、产品催化、政策催化、行业催化、资金催化
5. **短期弹性与资金博弈评估**：情绪温度、主导资金、弹性评分、短期盈亏比、关键价位
6. **情景推演与概率**：乐观/中性/悲观三种情景的概率、触发条件、目标价、涨跌幅
7. **同行业Top 5对比**：同赛道风险收益比最优的5只标的对比表
8. **操作建议**：当前阶段判定、建议仓位区间、建仓策略、止损线、止盈策略、退出条件

**核心原则**：
- 必须遵循"大盘→行业→个股→结论"的分析路径
- 缺少实时数据时必须明确标注
- 不编造任何数据，所有判断必须有逻辑支撑
- 明确提示：分析仅为研究参考，不构成投资建议`
  },
  {
    key: 'sector_stock_pick',
    title: '行业选股',
    description: '分析指定行业并推荐最优标的',
    icon: '🏭',
    category: '股票分析',
    structured: true,
    prompt: `请对以下行业进行全景分析并推荐最优标的：

**分析对象**：用户指定的行业（请在对话中确认具体行业名称）

**分析框架**：
1. **行业全景分析**：
   - 行业景气度判定（顺周期/景气上行/提价周期/困境反转/暂不关注）
   - 行业热度排名、行业阶段、资金流向
   - 近期催化事件清单

2. **全量标的对比表**：
   - 从该行业筛选不少于10只核心标的
   - 按风险收益比排序输出对比表（排名、股票、PE、PE分位、净利增速、机构持股、期望收益、盈亏比、弹性评分）

3. **Top 3深度分析**：
   - 对排名前三的标的分别输出完整的八模块分析

4. **操作建议汇总表**：
   - 每只推荐标的的建议仓位、止损线、核心逻辑

**核心原则**：
- 行业必须满足至少一类景气逻辑才可推荐
- 不满足景气条件的行业直接判定"暂不关注"
- 推荐标的必须有明确的止损线和退出条件`
  },
  {
    key: 'holding_stock_diagnosis',
    title: '持仓股票诊断',
    description: '诊断用户当前持仓的股票',
    icon: '🔍',
    category: '股票分析',
    structured: true,
    prompt: `请基于我的实际持仓数据，对我持有的每只股票进行诊断分析：

**分析框架**：
1. **持仓概览**：列出我当前持有的所有股票及其基本情况
2. **逐只诊断**：对每只持仓股票输出：
   - 一句话结论（继续持有/减仓/清仓）
   - 当前所处阶段（主升浪/上升趋势/震荡整理/下跌趋势）
   - 盈亏状态评估
   - 止盈/止损建议
   - 核心逻辑是否成立

3. **持仓整体评估**：
   - 持仓集中度风险
   - 行业分布均衡度
   - 整体风险收益比

4. **调仓建议**：
   - 需要减仓/清仓的标的及理由
   - 可继续持有或加仓的标的及理由
   - 建议新增的标的（如有）

请基于我的实际持仓数据进行分析，给出具体可执行的建议。`
  },
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

// ==================== 股票分析意图检测 ====================
/**
 * 检测用户消息是否包含股票分析意图
 * 当检测到股票分析意图时，自动注入分析框架提示
 */
const STOCK_ANALYSIS_KEYWORDS = [
  // 分析类关键词
  '分析', '诊断', '评估', '研报', '研究', '深度分析', '全面分析',
  // 股票相关关键词
  '股票', '个股', '标的', '这只', '那个股', '持仓', '仓位',
  // 行业相关关键词
  '行业', '板块', '赛道', '概念', '题材',
  // 推荐类关键词
  '推荐', '选股', '筛选', '值得买', '可以买', '买入', '卖出',
  // 比较类关键词
  '对比', '比较', '哪个好', '谁更好', '同行业',
  // 时机类关键词
  '买入时机', '卖出时机', '什么时候买', '什么时候卖', '入场', '离场',
  // 风险收益类关键词
  '风险', '收益', '盈亏', '止损', '止盈', '盈亏比',
  // 催化类关键词
  '催化', '利好', '利空', '消息', '公告',
  // 常见股票代码格式
  /^[0-9]{6}$/, // 6位数字股票代码
  /^(sh|sz|bj)?[0-9]{6}$/i, // 带市场前缀的股票代码
]

const STOCK_ANALYSIS_PATTERNS = [
  /分析[一下]?[这那].*[股票个股]/,
  /[这那].*[股票个股].*[怎么样好不好]/,
  /[股票个股].*[代码名称].*[分析]/,
  /推荐[一下]?.*[行业板块赛道].*[股票个股]/,
  /[行业板块赛道].*[选股推荐筛选]/,
  /[对比比较].*[这那两].*[股票个股]/,
  /[持仓].*[诊断分析]/,
  /[买入卖出].*[时机点位]/,
  /[止损止盈].*[价位位置]/,
]

/**
 * 检测是否为股票分析意图
 */
function detectStockAnalysisIntent(message: string): boolean {
  const lowerMsg = message.toLowerCase()
  
  // 检查关键词
  for (const keyword of STOCK_ANALYSIS_KEYWORDS) {
    if (typeof keyword === 'string' && lowerMsg.includes(keyword)) {
      return true
    }
    if (keyword instanceof RegExp && keyword.test(message)) {
      return true
    }
  }
  
  // 检查模式
  for (const pattern of STOCK_ANALYSIS_PATTERNS) {
    if (pattern.test(message)) {
      return true
    }
  }
  
  return false
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
    // 构建基础财务上下文
    let context = options.context ?? buildFinancialContext()
    
    // 检测股票分析意图，自动注入分析框架和实时数据
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || ''
    if (detectStockAnalysisIntent(lastUserMessage)) {
      const stockHint = extractStockHint(lastUserMessage)
      const realtimeData = await fetchRealtimeStockData(stockHint, lastUserMessage)
      context += buildStockAnalysisContext(stockHint, realtimeData)
    }
    
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

// ==================== 实时股票数据获取 ====================

interface RealtimeStockData {
  targetStock?: StockData
  marketIndices?: Array<{ name: string; price: number; changePercent: number }>
  holdings?: StockData[]
  fetchTime: string
}

async function fetchRealtimeStockData(stockHint: string | undefined, message: string): Promise<RealtimeStockData> {
  const result: RealtimeStockData = {
    fetchTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  }

  // 1. 获取大盘指数（总是获取，作为市场环境参考）
  try {
    const indices = await fetchIndexQuotes()
    result.marketIndices = indices.map(i => ({
      name: i.name,
      price: i.price,
      changePercent: i.changePercent
    }))
  } catch (e) {
    console.warn('[ai] 获取大盘指数失败:', e)
  }

  // 2. 如果有明确的股票提示，搜索并获取行情
  if (stockHint) {
    try {
      // 先搜索股票代码
      const searchResults = await searchSecurities(stockHint, 'stock')
      if (searchResults.length > 0) {
        const targetCode = searchResults[0].code
        const stockData = await fetchStockPrice(targetCode)
        if (stockData) {
          result.targetStock = stockData
        }
      }
    } catch (e) {
      console.warn('[ai] 获取目标股票行情失败:', e)
    }
  }

  // 3. 获取当前用户持仓股票的实时行情
  try {
    const holdingStore = useHoldingStore.getState()
    const authStore = useAuthStore.getState()
    const currentUserId = authStore.user?.id || ''
    const currentUserEmail = authStore.user?.email || ''
    
    // 只取当前用户的持仓（防止串号）
    const allHoldings = holdingStore.holdings || []
    const userHoldings = allHoldings.filter((h: any) => {
      if (h.userId && currentUserId) return h.userId === currentUserId
      if (h.userEmail && currentUserEmail) return h.userEmail === currentUserEmail
      // 如果持仓没有用户标记，且当前没有用户，也返回（兼容本地测试）
      return !h.userId && !h.userEmail && !currentUserId && !currentUserEmail
    })
    
    const stockHoldings = userHoldings.filter((h: any) => h.type === 'stock')
    if (stockHoldings.length > 0) {
      const holdingPromises = stockHoldings.slice(0, 5).map((h: any) => fetchStockPrice(h.code || h.symbol))
      const holdingResults = await Promise.all(holdingPromises)
      result.holdings = holdingResults.filter((s): s is StockData => s !== null)
    }
  } catch (e) {
    console.warn('[ai] 获取持仓行情失败:', e)
  }

  return result
}

function buildStockAnalysisContext(stockHint?: string, realtimeData?: RealtimeStockData): string {
  let ctx = '\n\n## 股票分析请求\n'
  ctx += '用户的问题涉及股票分析，请严格按照股票分析专用框架的八模块格式输出。\n\n'
  
  // 注入实时数据 - 放在最显眼的位置，用明确的边界标记
  if (realtimeData) {
    ctx += '═══════════════════════════════════════════\n'
    ctx += '【已核实的真实数据 — 分析必须完全基于以下事实】\n'
    ctx += '═══════════════════════════════════════════\n\n'
    ctx += `数据获取时间：${realtimeData.fetchTime}\n\n`
    
    // 目标股票 - 放在最前面，最醒目
    if (realtimeData.targetStock) {
      const s = realtimeData.targetStock
      const sign = s.changePercent >= 0 ? '+' : ''
      ctx += '### ✅ 已核实股票身份（分析标的唯一正确信息）\n'
      ctx += `| 项目 | 数值 |\n|------|------|\n`
      ctx += `| **股票名称** | **${s.name}** |\n`
      ctx += `| **股票代码** | **${s.code}** |\n`
      ctx += `| 交易所 | ${s.code.startsWith('6') || s.code.startsWith('5') ? '上交所(SH)' : s.code.startsWith('0') || s.code.startsWith('3') ? '深交所(SZ)' : '北交所(BJ)'} |\n`
      ctx += `| 最新价 | ¥${s.price.toFixed(2)} |\n`
      ctx += `| 涨跌幅 | ${sign}${s.changePercent.toFixed(2)}% |\n`
      ctx += `| 涨跌额 | ${sign}${s.change.toFixed(2)}元 |\n`
      ctx += `| 今开 | ¥${s.open.toFixed(2)} |\n`
      ctx += `| 昨收 | ¥${s.prevClose.toFixed(2)} |\n`
      if (s.high !== undefined && s.high > 0) ctx += `| 最高 | ¥${s.high.toFixed(2)} |\n`
      if (s.low !== undefined && s.low > 0) ctx += `| 最低 | ¥${s.low.toFixed(2)} |\n`
      if (s.volume !== undefined && s.volume > 0) ctx += `| 成交量 | ${(s.volume / 10000).toFixed(2)}万手 |\n`
      if (s.turnover !== undefined && s.turnover > 0) ctx += `| 成交额 | ${(s.turnover / 10000).toFixed(2)}亿元 |\n`
      if (s.turnoverRate !== undefined && s.turnoverRate > 0) ctx += `| 换手率 | ${s.turnoverRate.toFixed(2)}% |\n`
      if (s.pe !== undefined && s.pe > 0) ctx += `| 市盈率(PE) | ${s.pe.toFixed(2)} |\n`
      if (s.pb !== undefined && s.pb > 0) ctx += `| 市净率(PB) | ${s.pb.toFixed(2)} |\n`
      if (s.totalMarketCap !== undefined && s.totalMarketCap > 0) ctx += `| 总市值 | ${s.totalMarketCap.toFixed(2)}亿 |\n`
      if (s.circulatingMarketCap !== undefined && s.circulatingMarketCap > 0) ctx += `| 流通市值 | ${s.circulatingMarketCap.toFixed(2)}亿 |\n`
      if (s.industry) ctx += `| 所属行业 | ${s.industry} |\n`
      ctx += `| 数据来源 | ${s.source || '综合数据源'} |\n\n`
      ctx += `> ⚠️ 重要：以上是唯一经过核实的股票信息。你必须使用「${s.name}（${s.code}）」作为分析标的，禁止使用其他名称或代码。\n\n`
    } else if (stockHint) {
      ctx += '### ⚠️ 股票身份未核实\n'
      ctx += `用户提到的关键词：「${stockHint}」\n`
      ctx += `> 未能搜索到匹配的股票。请在分析开头明确说明："未找到与「${stockHint}」匹配的股票，请确认股票名称或代码。"\n\n`
    }
    
    // 大盘指数
    if (realtimeData.marketIndices && realtimeData.marketIndices.length > 0) {
      ctx += '### 📊 大盘指数（实时行情）\n'
      ctx += '| 指数 | 最新点位 | 涨跌幅 |\n|------|----------|--------|\n'
      for (const idx of realtimeData.marketIndices) {
        const sign = idx.changePercent >= 0 ? '+' : ''
        ctx += `| ${idx.name} | ${idx.price.toFixed(2)} | ${sign}${idx.changePercent.toFixed(2)}% |\n`
      }
      ctx += '\n'
    }
    
    // 用户持仓
    if (realtimeData.holdings && realtimeData.holdings.length > 0) {
      ctx += '### 💼 用户持仓股票（实时行情）\n'
      ctx += '| 股票 | 代码 | 最新价 | 涨跌幅 |\n|------|------|--------|--------|\n'
      for (const h of realtimeData.holdings) {
        const sign = h.changePercent >= 0 ? '+' : ''
        ctx += `| ${h.name} | ${h.code} | ¥${h.price.toFixed(2)} | ${sign}${h.changePercent.toFixed(2)}% |\n`
      }
      ctx += '\n'
    }
    
    ctx += '═══════════════════════════════════════════\n'
    ctx += '【数据结束】\n'
    ctx += '═══════════════════════════════════════════\n\n'
  }
  
  ctx += '## 分析规则重申\n'
  ctx += '1. 所有事实性陈述（股票名称、代码、价格、财务数据等）必须来自上面的【已核实的真实数据】\n'
  ctx += '2. 没有数据的维度，请明确写「数据不足」，绝对不能编造或猜测\n'
  ctx += '3. 你可以基于已有数据和常识进行逻辑推演，但必须标注「逻辑推演」\n'
  ctx += '4. 分析路径：大盘环境 → 行业判断 → 个股分析 → 操作建议\n\n'
  
  return ctx
}

/**
 * 从用户消息中提取股票搜索关键词
 * 优先匹配股票代码，否则尝试提取可能的股票名称
 */
function extractStockHint(message: string): string | undefined {
  // 1. 优先匹配股票代码格式（6位数字）
  const codeMatch = message.match(/\b[0-9]{6}\b/)
  if (codeMatch) {
    return codeMatch[0]
  }
  
  // 2. 匹配带市场前缀的代码
  const prefixedCodeMatch = message.match(/(sh|sz|bj)[0-9]{6}/i)
  if (prefixedCodeMatch) {
    return prefixedCodeMatch[0]
  }
  
  // 3. 从消息中提取可能的股票名称关键词
  // 移除常见的分析类词汇，提取名词部分
  const cleaned = message
    .replace(/分析|诊断|评估|研究|一下|看看|说说|怎么样|如何|推荐|买入|卖出/g, '')
    .replace(/股票|个股|标的|这只|那只|这个|那个|持仓|仓位|行情|走势/g, '')
    .replace(/[，。？！,.\s]+/g, ' ')
    .trim()
  
  // 如果清洗后还有 2-6 个中文字符，可能是股票名
  if (cleaned && cleaned.length >= 2 && cleaned.length <= 8) {
    return cleaned
  }
  
  // 4. 尝试提取 2-4 个字的中文词组作为候选
  const cnWords = message.match(/[\u4e00-\u9fa5]{2,4}/g)
  if (cnWords && cnWords.length > 0) {
    // 过滤掉常见的非股票词
    const stopWords = new Set([
      '分析', '诊断', '评估', '研究', '一下', '看看', '说说',
      '股票', '个股', '标的', '持仓', '仓位', '行情', '走势',
      '怎么样', '如何', '推荐', '买入', '卖出', '可以',
      '今天', '明天', '最近', '现在', '目前', '什么', '这个', '那个',
    ])
    const candidates = cnWords.filter(w => !stopWords.has(w) && w.length >= 2 && w.length <= 4)
    if (candidates.length > 0) {
      return candidates[0]
    }
  }
  
  return undefined
}

// 离线降级回复
function mockReply(question: string): string {
  // 如果检测到股票分析意图，返回专门的提示
  if (detectStockAnalysisIntent(question)) {
    const stockHint = extractStockHint(question)
    return `📈 股票分析模式已激活${stockHint ? ` — 分析对象：${stockHint}` : ''}

⚠️ 当前处于**离线模拟模式**，AI 分析功能需要部署到 Cloudflare Pages 环境才能使用。

**在正式环境中，您将获得**：
1. 一句话结论（重点关注/跟踪观察/谨慎观望/暂不推荐）
2. 行业景气度与资金流向分析
3. 个股定位（赛道地位、盈利确定性、筹码/估值位置）
4. 未来2-3个月催化事件清单
5. 短期弹性与资金博弈评估
6. 情景推演与概率（乐观/中性/悲观）
7. 同行业Top 5对比表
8. 具体操作建议（含止损线、仓位区间）

**部署后测试方法**：
1. 将代码部署到 GitHub
2. Cloudflare Pages 自动构建
3. 在预览环境（*.pages.dev）中测试

---
💡 提示：请在 Cloudflare Pages 预览环境或生产环境中测试完整功能。`
  }
  
  return `📊 现状分析：根据你的账户数据看，已识别持仓与资产。

⚠️ 风险提示：建议保持资产分散，避免单一行业过度集中。

💡 优化建议：
1. 保持应急资金 3-6 个月支出
2. 权益类（股票+基金）占比建议 30-60%
3. 定期检视并再平衡

🎯 行动计划：
- 本月内完成一次持仓体检
- 设定止盈止损规则

（注：当前为离线模拟回复，配置 AI 服务后可获得真实建议）`
}

export { buildFinancialContext, loadHistoryFromApi, saveHistoryToApi, getLocalHistory, saveLocalHistory }
