import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAuthStore } from '../renderer/stores/authStore'

import { detectStrategy, buildStrategyPrompt, type StrategyConfig } from '../config/strategies'
import { getApiBaseUrl } from '../utils/apiUrl'

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

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token
  const baseUrl = getApiBaseUrl()
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`,
      ...(options.headers || {})
    }
  })
}

// ==================== 上下文构建（精简高效版）====================
function buildFinancialContext(): string {
  const assets = useAssetStore.getState().assets || []
  const holdings = useHoldingStore.getState().holdings || []

  const stockHoldings = holdings.filter(h => h.type === 'stock')
  const fundHoldings = holdings.filter(h => h.type === 'fund')
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentPrice || 0) * (h.quantity || 0), 0)
  const totalCost = holdings.reduce((sum, h) => sum + (h.avgCost || 0) * (h.quantity || 0), 0)
  const totalProfit = totalValue - totalCost
  const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0



  const lines: string[] = []

  // 1. 精简总览（一行搞定）
  lines.push(`【我的持仓】市值¥${totalValue.toFixed(0)} 盈亏${totalProfit >= 0 ? '+' : ''}¥${totalProfit.toFixed(0)}(${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%) 股票${stockHoldings.length}只 基金${fundHoldings.length}只`)

  // 2. 股票持仓（精简格式）
  if (stockHoldings.length > 0) {
    lines.push('【股票】')
    for (const h of stockHoldings) {
      const profit = ((h.currentPrice || 0) - (h.avgCost || 0)) * (h.quantity || 0)
      const rate = (h.avgCost || 0) > 0 ? (((h.currentPrice || 0) - (h.avgCost || 0)) / (h.avgCost || 0)) * 100 : 0
      lines.push(`  ${h.symbol} ${h.name} ${h.quantity}股 成本${(h.avgCost || 0).toFixed(2)} 现价${(h.currentPrice || 0).toFixed(2)} 盈亏${profit >= 0 ? '+' : ''}${profit.toFixed(0)}(${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%)`)
    }
  }

  // 3. 基金持仓（精简格式）
  if (fundHoldings.length > 0) {
    lines.push('【基金】')
    for (const h of fundHoldings) {
      const profit = ((h.currentPrice || 0) - (h.avgCost || 0)) * (h.quantity || 0)
      const rate = (h.avgCost || 0) > 0 ? (((h.currentPrice || 0) - (h.avgCost || 0)) / (h.avgCost || 0)) * 100 : 0
      lines.push(`  ${h.symbol} ${h.name} ${h.quantity}份 成本${(h.avgCost || 0).toFixed(4)} 现价${(h.currentPrice || 0).toFixed(4)} 盈亏${profit >= 0 ? '+' : ''}${profit.toFixed(0)}(${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%)`)
    }
  }

  // 4. 其他资产（按类别汇总）
  if (assets.length > 0) {
    const byCategory: Record<string, number> = {}
    for (const a of assets) {
      byCategory[a.category] = (byCategory[a.category] || 0) + a.amount
    }
    const assetParts = Object.entries(byCategory).map(([cat, amount]) => `${cat}¥${amount.toFixed(0)}`)
    lines.push(`【其他资产】${assetParts.join(' ')}`)
  }

  lines.push('（以上为你的真实持仓数据，请基于此进行分析）')

  return lines.join('\n')
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
    prompt: `【个股深度分析模式】

请按照以下严格的四步投研框架对用户指定的股票进行深度分析，不得跳过任何步骤。

===== 第一步：市场整体环境判断 =====
从四个维度量化判定当前市场可操作性：
1. **全市场估值水平**：万得全A PE(TTM)/PB历史分位、股债风险溢价ERP、巴菲特指标
2. **宏观经济周期位置**：PMI荣枯线、PPI工业价格、社融与利率、美元指数
3. **市场流动性**：北向资金流向、融资余额增速、两市日均成交额
4. **市场风险偏好**：涨跌家数比、涨停/跌停数量、连板高度、炸板率

输出四维度综合判定矩阵结论。

===== 第二步：行业景气度筛选 =====
必须先判定所属行业是否满足至少一类核心景气逻辑：
- 顺周期行业：PMI连续≥3个月>50 + 营收增速连续≥2季度改善
- 景气度上行：销量/产量增速连续≥2季度为正 + 毛利率环比不降
- 产品提价周期：产品价格同比涨幅≥10%且持续≥1季度
- 困境反转：政策拐点/需求拐点/成本拐点/供给拐点（至少2项）

不满足则直接判定"暂不关注"。

输出：行业热度排名、行业阶段（启动/主升/高位震荡/退潮）、资金流向、综合判定。

===== 第三步：个股三维深度分析 =====
从三个维度严格筛选：
1. **盈利质量**：营收/净利增速趋势、毛利率净利率、经营现金流匹配度、业绩可持续性
2. **机构抱团程度**：机构持仓比例及变化、券商覆盖密度、抱团拥挤度预警（≥30%触发）
3. **筹码结构**：筹码集中度、主力资金动向、股价位置、套牢盘压力与支撑

必须包含：
- 个股赛道地位（技术实力/盈利确定性/机构抱团度/市场共识位置）
- 未来2-3个月催化事件清单（业绩/产品/政策/行业/资金催化）
- 市场情绪与资金流向分析
- 三种情景推演（乐观/中性/悲观）及概率估算
- 短期弹性评分卡（5维度，满分100分）
- 同行业Top 5全量标的对比表 + 替代推荐

===== 第四步：标准化结论输出 =====
必须给出四类明确结论之一：
- 重点关注（可建仓）| 跟踪观察（等待买点）| 谨慎观望（逻辑一般）| 暂不推荐（逻辑不成立）

附置信度（高/中/低），同步输出：
- 核心看多/看空逻辑
- 主要风险点
- 建议仓位区间
- 适配操作风格

操作建议必须根据当前市场阶段动态适配（主升浪/强势上升/上升趋势/震荡整理/下跌趋势），包含：
- 建仓策略（分批）
- 止损线（硬性15%）
- 止盈策略
- 退出条件
- 持仓状态差异化建议（空仓/盈利中/亏损中）

===== 输出格式 =====
严格按以下8模块结构输出Markdown表格：
1. 一句话结论
2. 行业景气度与资金流向（表格）
3. 个股定位
4. 未来2-3个月催化事件（表格）
5. 短期弹性与资金博弈评估（表格）
6. 情景推演与概率（表格）
7. 同行业Top 5对比（表格）
8. 操作建议（表格 + 阶段策略矩阵）

【核心红线】
- 不编造任何数据，缺少实时数据必须明确标注
- 每笔操作必须设定止损线
- 短期盈亏比<2:1不建议短线参与
- 极端行情下暂停建仓建议
- 明确提示：分析仅为研究参考，不构成投资建议，投资有风险，入市需谨慎`
  },
  {
    key: 'sector_stock_pick',
    title: '行业选股',
    description: '分析指定行业并推荐最优标的',
    icon: '🏭',
    category: '股票分析',
    structured: true,
    prompt: `【行业选股模式】

请对用户指定的行业进行全景分析，按照四步投研框架筛选并推荐最优标的。

===== 第一步：市场整体环境判断 =====
（同个股深度分析框架）评估当前大盘环境是否适合参与该行业。

===== 第二步：景气行业筛选 =====
严格验证该行业是否满足至少一类核心景气逻辑：
- 顺周期行业必要条件核验
- 行业景气度上行必要条件核验
- 产品提价周期必要条件核验
- 困境反转拐点信号核验（至少2项）

不满足则直接判定"暂不关注"，不推荐任何标的。

输出：行业景气度判定、行业热度排名、行业阶段、近期催化事件。

===== 第三步：全量标的深度比选 =====
必须对该行业所有可比上市公司（通常8-20只）进行内部全量分析，逐一完成：
1. 基本面速览：营收增速、净利增速、毛利率、ROE、经营现金流/净利润
2. 估值定位：PE(TTM)、PE历史分位、PB、PEG
3. 机构动向：机构持股比例、增减仓方向、券商覆盖数
4. 赛道地位：技术实力排名、市占率、护城河
5. 风险收益比：情景推演 + 概率加权期望收益
6. 核心催化：未来2-3个月关键催化事件

按以下权重筛选Top 5：
- 风险收益比（40%）
- 盈利确定性（25%）
- 估值性价比（20%）
- 拥挤度安全边际（15%）

===== 第四步：结论输出 =====
输出：
1. **行业全景分析**：景气度+资金流向+催化事件
2. **全量标的对比表**（不少于10只）：排名、股票、代码、市值、Q1净利增速、PE(TTM)、PE分位、机构持股、期望收益、盈亏比、弹性评分、综合评级
3. **Top 3深度分析**：每只分别输出完整的八模块分析（同个股深度分析格式）
4. **操作建议汇总表**：排名、股票、建议仓位、止损线、核心逻辑

【核心红线】
- 不满足景气条件的行业不推荐
- 每只推荐标的必须有明确止损线
- 机构持仓≥30%自动降一档建议
- 明确提示：分析仅为研究参考，不构成投资建议`
  },
  {
    key: 'risk_assessment',
    title: '风险评估',
    description: '评估持仓风险等级和集中度',
    icon: '⚠️',
    category: '风险分析',
    structured: true,
    prompt: `【持仓风险评估模式】

请基于用户的实际持仓数据，进行全面的投资组合风险评估。

===== 一、整体风险等级评定 =====
从以下维度综合评定：
1. **仓位风险**：权益类资产占总资产比例
2. **集中度风险**：单只最高占比、前三大合计占比、前五大合计占比
3. **行业集中度**：最高行业占比、行业数量（分散度）、行业相关性
4. **估值风险**：持仓整体PE分位、高估值标的占比
5. **流动性风险**：小盘股占比、日成交额不足1亿标的数量
6. **杠杆风险**：是否使用融资/配资、杠杆比例

输出整体风险等级（低/中低/中/中高/高）及评定依据。

===== 二、分项风险拆解 =====
1. **单票集中度风险**：
   - 第一大持仓占比（名称+占比+金额）
   - 前三大持仓合计占比
   - 前五大持仓合计占比
   - 是否触发"单票≥20%为高风险"红线

2. **行业集中度风险**：
   - 各行业持仓占比排名
   - 最高行业占比（行业名称+占比）
   - 行业数量（分散度）
   - 是否触发"单行业≥40%为高风险"红线

3. **风格暴露风险**：
   - 价值/成长/周期/消费/科技 风格分布
   - 大小盘分布
   - 高beta标的占比

4. **个股质量风险**：
   - 亏损标的数量及占比
   - 高估值（PE>80）标的数量及占比
   - ST/问题标的排查

===== 三、极端情景压力测试 =====
1. **大盘下跌10%情景**：组合预期回撤幅度
2. **行业黑天鹅情景**：持仓最高行业下跌20%，组合预期回撤
3. **单票跌停情景**：最大持仓连续3个跌停，组合影响

===== 四、风险点清单 =====
按严重程度排序列出前5大风险点，每个标注：
- 风险类型
- 影响程度（高/中/低）
- 触发条件
- 当前状态（已暴露/潜在）

===== 五、风险管理建议 =====
给出3-5条具体可执行的风险对冲或分散建议：
1. 集中度分散建议（具体到标的/比例）
2. 行业再平衡建议
3. 止损纪律建议
4. 仓位控制建议
5. 对冲工具建议（如有）

【数据要求】
所有风险判断必须引用用户实际持仓数据支撑，禁止凭空臆断。
明确提示：风险评估基于当前数据，不构成投资建议，市场有风险。`
  },
  {
    key: 'portfolio_optimization',
    title: '组合优化建议',
    description: '给出具体的调仓建议',
    icon: '🎯',
    category: '优化建议',
    structured: true,
    prompt: `【组合优化模式】

请基于用户的当前持仓和资产状况，按照以下框架给出一份完整的组合优化建议方案。

===== 一、优化目标确立 =====
基于用户现状，明确2-3个核心优化目标（如：降低集中度、提升收益风险比、增强行业分散、控制回撤等）。

===== 二、当前组合诊断 =====
**优势分析（2-3条）**：
- 做得好的地方
- 可以保持的配置

**问题诊断（2-3条）**：
- 最突出的问题
- 需要改进的地方
- 按优先级排序

===== 三、优化原则 =====
明确本次优化遵循的核心原则：
- 风险收益比优先
- 分散化原则
- 景气度导向
- 估值安全边际
- 用户风险承受能力匹配

===== 四、具体调仓建议 =====
分三类列出，每只标的标注理由：

**【卖出/减仓】**（列出标的及理由）
- 标的名称/代码
- 当前占比
- 建议操作（全部卖出/减仓XX%）
- 核心理由（估值过高/逻辑变化/集中度过高/风险暴露过大等）

**【持有/加仓】**（列出标的及理由）
- 标的名称/代码
- 当前占比
- 建议操作（继续持有/加仓XX%）
- 核心理由（景气度上行/估值合理/逻辑强化等）

**【新增关注】**（建议新增的标的，Top 3）
- 标的名称/代码
- 所属行业
- 建议配置比例
- 核心理由（风险收益比最优）
- 买入条件/时机

===== 五、优化前后对比 =====
| 指标 | 优化前 | 优化后 | 变化方向 |
|------|--------|--------|----------|
| 持仓数量 | | | |
| 第一大持仓占比 | | | |
| 前三大合计占比 | | | |
| 行业数量 | | | |
| 最高行业占比 | | | |
| 整体PE分位 | | | |
| 预期年化收益 | | | |
| 预期最大回撤 | | | |
| 预期夏普比率 | | | |

===== 六、预期效果 =====
- 风险层面：预期降低的风险点
- 收益层面：预期改善的收益结构
- 分散度：预期提升的分散程度

===== 七、执行节奏 =====
1. **第一周**：优先处理（紧急调仓项）
2. **第二至三周**：逐步调整（非紧急项）
3. **后续跟踪**：需要观察验证的指标
4. **再平衡周期**：建议多久回顾一次

【核心原则】
- 所有建议必须基于用户实际持仓数据
- 调仓必须分批进行，禁止一次性满仓/清仓
- 每只标的必须有明确的买入/卖出逻辑
- 明确提示：优化建议仅供参考，不构成投资建议，投资有风险，入市需谨慎`
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

// ==================== 策略检测与注入 ====================
function injectStrategyIntoMessages(messages: ChatMessage[]): ChatMessage[] {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()
  if (!lastUserMessage) return messages

  const strategy = detectStrategy(lastUserMessage.content)
  if (!strategy) return messages

  // 在最后一条用户消息中注入策略指令
  const strategyPrompt = buildStrategyPrompt(strategy)
  const injectedContent = lastUserMessage.content + strategyPrompt

  return messages.map(m =>
    m === lastUserMessage ? { ...m, content: injectedContent } : m
  )
}

// ==================== 对话主函数 ====================
export async function chat(
  messages: ChatMessage[],
  options: { sessionId?: string; context?: string; strategy?: StrategyConfig } = {}
): Promise<{ reply: string; sessionId: string }> {
  const shouldUseApi = getApiBaseUrl() !== '/api' || typeof window !== 'undefined' && /pages\.dev$/.test(window.location.hostname)
  if (!shouldUseApi) {
    return { reply: mockReply(messages[messages.length - 1]?.content || ''), sessionId: options.sessionId || '' }
  }

  try {
    let processedMessages = [...messages]
    const lastUserMessage = processedMessages.filter(m => m.role === 'user').pop()?.content || ''

    // 检测用户消息中的策略意图
    const detectedStrategy = detectStrategy(lastUserMessage)
    if (detectedStrategy) {
      processedMessages = injectStrategyIntoMessages(processedMessages)
    } else if (options.strategy) {
      // 如果用户通过UI选择了策略，也注入
      const strategyPrompt = buildStrategyPrompt(options.strategy)
      const lastMsg = processedMessages[processedMessages.length - 1]
      if (lastMsg.role === 'user') {
        processedMessages[processedMessages.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + strategyPrompt
        }
      }
    }

    // 股票分析意图：调用专用API（后端联网搜索+数据获取+AI分析一体化）
    if (detectStockAnalysisIntent(lastUserMessage)) {
      const context = options.context ?? buildFinancialContext()
      const resp = await apiFetch('/ai/stock-analysis', {
        method: 'POST',
        body: JSON.stringify({ query: lastUserMessage, context })
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        return { reply: `⚠️ 股票分析服务异常：${err.error || resp.statusText}`, sessionId: options.sessionId || '' }
      }

      const json = await resp.json()
      return { reply: json.reply || json.data?.reply || '（AI 无回复）', sessionId: options.sessionId || '' }
    }

    // 普通对话：走原有流程
    const context = options.context ?? buildFinancialContext()
    const resp = await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: processedMessages, context })
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return { reply: `⚠️ AI 服务异常：${err.error || resp.statusText}`, sessionId: options.sessionId || '' }
    }

    const json = await resp.json()
    return { reply: json.reply || json.data?.reply || '（AI 无回复）', sessionId: options.sessionId || '' }
  } catch (e: any) {
    return { reply: `⚠️ 调用失败：${e.message || e}`, sessionId: options.sessionId || '' }
  }
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
