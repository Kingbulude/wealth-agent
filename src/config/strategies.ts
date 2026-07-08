// 交易策略配置
// 灵感来源：daily_stock_analysis (DSA) 项目的 YAML 策略系统
// 将策略转为 TypeScript 配置，注入 AI 提示词中

export interface StrategyConfig {
  name: string
  displayName: string
  description: string
  category: 'trend' | 'pattern' | 'reversal' | 'framework' | 'event'
  priority: number
  instructions: string
  aliases: string[]
}

// 核心策略库
export const STRATEGIES: StrategyConfig[] = [
  {
    name: 'bull_trend',
    displayName: '多头趋势',
    description: '识别多头排列、趋势延续与回踩低吸机会',
    category: 'trend',
    priority: 10,
    aliases: ['趋势', '趋势分析', '多头趋势'],
    instructions: `【多头趋势策略】

适用场景：常规个股分析的默认策略，优先寻找"趋势向上 + 风险可控 + 不追高"的机会。

分析框架：
1. **趋势确认（优先级最高）**
   - 判断 MA5/MA10/MA20 排列。
   - MA5 >= MA10 >= MA20 且 MA20 斜率向上，视为多头结构。
   - 若价格显著跌破 MA20，则降低看多权重。

2. **位置与节奏**
   - 优先"回踩不破"而非"高位追涨"。
   - 当价格距离 MA5/MA10 过远时，提示等待回踩。
   - 放量突破有效阻力时可提高胜率评级。

3. **量价验证**
   - 检查突破日/反弹日是否放量。
   - 缩量上涨需谨慎，放量滞涨需警惕分歧。

4. **交易建议输出**
   - 输出明确的"买入/观望/减仓"倾向及触发条件。
   - 必须给出止损参考（如 MA20 下方或结构低点）。
   - 若无清晰优势，明确写"暂不出手"，避免过度交易。`
  },
  {
    name: 'ma_golden_cross',
    displayName: '均线金叉',
    description: '检测均线金叉配合量能确认信号，经典的趋势反转/延续信号',
    category: 'trend',
    priority: 20,
    aliases: ['均线金叉', '金叉'],
    instructions: `【均线金叉策略】

信号判定标准：
1. **金叉检测**：
   - 主信号：MA5 在最近 3 个交易日内上穿 MA10。
   - 强信号：MA10 上穿 MA20（更慢但更可靠）。
   - 检查 MACD 状态是否为金叉或零轴上方金叉。

2. **量能确认**：
   - 金叉日成交量应高于 5 日均量。
   - 金叉日量比 > 1.2 为积极信号。

3. **趋势背景**：
   - 盘整后金叉：最强信号。
   - 上升趋势中金叉：延续信号。
   - 深度下跌中金叉：弱信号，需更多确认。

4. **价格位置**：
   - 价格应在交叉均线附近或上方。
   - 乖离率 < 5% — 避免追高延迟入场。

评分调整：
- MA5 × MA10 金叉配合量能：看多 +10
- MA10 × MA20 金叉：看多 +8
- MACD 零轴上方金叉：额外 +5
- 理想买点设在交叉均线水平附近。`
  },
  {
    name: 'volume_breakout',
    displayName: '放量突破',
    description: '检测放量突破阻力位信号，适用于股价接近已知阻力位时',
    category: 'trend',
    priority: 30,
    aliases: ['放量突破', '突破'],
    instructions: `【放量突破策略】

突破判定标准：
1. **阻力位识别**：
   - 通常为 20 日高点或前期震荡平台顶部。

2. **量能确认**：
   - 当日成交量 > 5 日均量的 2 倍。
   - 量比 > 2.0 为积极信号。

3. **价格确认**：
   - 收盘价必须站上阻力位。
   - 收盘应在当日振幅上方 30%（强势收盘）。
   - 突破后乖离率检查：仍需 < 5%，避免追高。

4. **后续验证**：
   - 次日开盘应在突破位之上，区分真突破与假突破。

5. **风险过滤**：
   - 检查无重大利空。
   - PE 不应过高（避免泡沫型突破）。

评分调整：
- 放量突破确认：看多 +12
- 突破伴随板块共振（板块也走强）：额外 +5
- 理想买点设在突破位附近，止损设在突破位下方 3%。`
  },
  {
    name: 'growth_quality',
    displayName: '成长质量',
    description: '结合收入利润增长、ROE、现金流和行业空间，识别高质量成长股',
    category: 'framework',
    priority: 55,
    aliases: ['成长', '成长股', '成长质量'],
    instructions: `【成长质量策略】

适用场景：关注公司中长期成长能力，适合高景气行业、业绩持续改善的公司。

分析框架：
1. **成长性**
   - 优先查看营业收入、归母净利润、经营现金流和 ROE。
   - 判断收入增长和利润增长是否同向，是否存在"增收不增利"。
   - 若只有概念热度但财报尚未验证，应降低成长确定性。

2. **质量**
   - ROE 越高且稳定，质量越好。
   - 经营现金流与净利润方向一致，说明盈利质量更可靠。
   - 现金流显著弱于利润时，要提示回款、存货或应收风险。

3. **估值承受力**
   - 使用 PE/PB、市值等估值字段判断市场是否已经提前透支成长。
   - 高成长可承受更高估值，但必须说明增长能否覆盖估值。
   - 估值高且成长放缓时，应明显下调评分。

4. **趋势确认**
   - 判断长期成长逻辑是否被市场资金确认。
   - 基本面向好但技术面未确认时，优先给观察条件而不是直接追买。

输出要求：
- 明确公司处于：高质量成长 / 成长验证中 / 成长放缓 / 成长证伪。
- 说明成长来自收入扩张、利润率改善、行业景气，还是一次性因素。
- 给出适合成长股的买点：业绩验证后突破、回踩长期均线或估值回落。`
  },
  {
    name: 'event_driven',
    displayName: '事件驱动',
    description: '捕捉催化事件带来的阶段性机会，包括业绩、产品、政策、重组等',
    category: 'event',
    priority: 40,
    aliases: ['事件', '催化', '事件驱动'],
    instructions: `【事件驱动策略】

适用场景：捕捉催化事件带来的阶段性机会。

分析框架：
1. **催化事件识别**
   - 业绩催化：季报/年报超预期、业绩拐点。
   - 产品催化：新产品发布、技术突破、订单落地。
   - 政策催化：行业政策利好、监管放松、补贴加码。
   - 重组催化：并购、资产注入、分拆上市。
   - 资金催化：大股东增持、机构调研密集、北向资金大幅流入。

2. **事件质量评估**
   - 可持续性：一次性事件 vs 持续性改善。
   - 确定性：已落地 vs 预期中 vs 传闻阶段。
   - 影响幅度：对业绩/估值的量化影响。

3. **时间窗口**
   - 事件前：埋伏窗口（风险较高）。
   - 事件后：确认窗口（确定性更高，但空间可能收窄）。
   - 市场反应期：通常 3-10 个交易日。

4. **风险控制**
   - 事件证伪风险：预期落空后的下跌幅度。
   - 利好出尽风险：事件落地后资金获利了结。
   - 必须设置止损线，事件驱动止损通常更严格（5-8%）。

评分调整：
- 高确定性 + 可持续催化：看多 +15
- 已落地且市场反应积极：看多 +10
- 传闻阶段/不确定性高：观望，不加分
- 事件证伪或利好出尽：看空 -10`
  },
]

// 根据关键词检测用户选择的策略
export function detectStrategy(message: string): StrategyConfig | null {
  const lowerMsg = message.toLowerCase()
  for (const strategy of STRATEGIES) {
    // 检查策略名称匹配
    if (lowerMsg.includes(strategy.displayName.toLowerCase())) {
      return strategy
    }
    // 检查别名匹配
    for (const alias of strategy.aliases) {
      if (lowerMsg.includes(alias.toLowerCase())) {
        return strategy
      }
    }
  }
  return null
}

// 构建策略注入提示词
export function buildStrategyPrompt(strategy: StrategyConfig): string {
  return `\n\n【当前激活策略：${strategy.displayName}】\n${strategy.instructions}\n\n请严格按照上述策略框架进行分析，在结论中注明策略名称。`
}

// 默认策略（当用户未指定时使用）
export const DEFAULT_STRATEGY = STRATEGIES.find(s => s.name === 'bull_trend')!

// 按优先级排序的策略列表
export const STRATEGIES_BY_PRIORITY = [...STRATEGIES].sort((a, b) => a.priority - b.priority)
