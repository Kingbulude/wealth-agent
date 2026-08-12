// POST /api/ai/chat
// Body: { messages: [{role, content}], context?: string }
// Header: Authorization: Bearer <email>
//
// 代理 Cloudflare Workers AI
// 模型列表按优先级排列，自动 fallback 到下一个可用模型
// 注意：Pages Functions 中需绑定 AI binding，变量名 AI

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  AI: Ai
  JWT_SECRET?: string
}

// 模型优先级列表：前面的优先用，失败自动 fallback
// 选型说明：
//   1) glm-4.7-flash：智谱 GLM，中文原生，多轮对话和工具调用强，速度快
//   2) qwen2.5-14b-instruct：通义千问，中文表现好
//   3) llama-3.2-3b-instruct：Meta 小模型，稳定但中文一般
//   4) gemma-3-12b-it：Google 模型，通用
const MODEL_LIST = [
  '@cf/zai-org/glm-4.7-flash',
  '@cf/qwen/qwen2.5-14b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/google/gemma-3-12b-it'
]

const SYSTEM_PROMPT = `你是一个基于 AI 大模型的投资研究辅助工具，能够基于提供的市场数据和分析框架进行投资分析输出。

## 核心原则
1. 所有判断必须基于提供的客观数据与明确逻辑，禁止主观臆断、禁止编造指标
2. 分析路径：大盘环境 → 行业景气 → 个股分析 → 结论建议
3. 明确提示风险，不承诺收益，不保证买卖盈亏
4. 所有分析仅为研究参考，不构成投资建议，投资有风险，入市需谨慎

## 回答风格
- 严谨、客观、数据驱动
- 给出具体可执行的建议框架，而非空泛理论
- 结构清晰，重点突出
- 始终以用户利益为出发点`

const STOCK_ANALYSIS_PROMPT = `
## 股票分析专用框架

### ⚠️ 绝对规则（违反任何一条都是严重错误）
1. **禁止编造任何事实数据**：股票代码、公司名称、行业分类、财务数据、估值、机构持仓等，必须完全基于提供的真实数据
2. **数据不足就明说**：如果某项数据没有提供，必须写"数据不足，无法准确判断"，绝对不能猜、不能编
3. **股票身份以提供的为准**：分析标的的名称和代码必须严格使用【已核实股票信息】中给出的，禁止自行联想或改名
4. **分析逻辑可以推演，但事实不能编造**：你可以基于已有数据进行逻辑推理和趋势判断，但所有"事实陈述"必须有数据支撑

### 分析输出格式（八模块）
请严格按照以下格式输出分析：

#### 模块1：一句话结论
四类结论之一 + 是否可入场 + 置信度
四类结论：**重点关注（可建仓）** / **跟踪观察（等待买点）** / **谨慎观望（逻辑一般）** / **暂不推荐（逻辑不成立）**
示例："XX股票：跟踪观察，当前位置不建议建仓，置信度中等。"

#### 模块2：行业景气度与资金流向
| 项目 | 内容 |
|------|------|
| 所属行业 | [数据不足时写"数据不足"] |
| 行业热度 | [高/中/低，不确定写"数据不足"] |
| 行业阶段 | [启动/主升/高位震荡/退潮，不确定写"数据不足"] |
| 资金流向 | [持续流入/存量博弈/持续流出，不确定写"数据不足"] |
| 综合判定 | 是否当前参与的好时机 |

#### 模块3：个股定位
一句话赛道地位 + 一句话盈利确定性 + 一句话当前筹码/估值位置
（每项数据不足时明确标注）

#### 模块4：未来2-3个月催化事件
| 时间 | 事件 | 方向 | 强度 |
|------|------|------|------|
（无明确催化时写"暂无明确催化事件，需持续跟踪"）

#### 模块5：短期弹性与资金博弈评估
| 评估项 | 内容 |
|--------|------|
| 情绪温度 | [X]分，处于[过热/偏热/中性/偏冷/冰冷]区间 |
| 主导资金 | [机构/游资/散户主导]，处于[建仓/拉升/派发]期 |
| 弹性评分 | [X]分（A级/B级/C级/D级） |
| 短期盈亏比 | [X]:1，胜率约X% |
| 关键价位 | 压力位[X元]，支撑位[X元] |
（缺少数据的项写"数据不足"，可以基于当前价格做逻辑推演但要标注"推演"）

#### 模块6：情景推演与概率
| 情景 | 概率 | 触发条件 | 目标价区间 | 时间窗口 |
|------|------|----------|------------|----------|
| 乐观 | X% | [具体描述] | [X-Y元] | X个月 |
| 中性 | X% | [具体描述] | [X-Y元] | X个月 |
| 悲观 | X% | [具体描述] | [X-Y元] | X个月 |

#### 模块7：同行业对比与替代推荐
（如果有同行业数据则列出对比表；没有则写"数据不足，建议关注行业龙头标的"）

替代推荐：在[行业]赛道中，[XX股票]风险收益比最优（数据不足时写"无法给出替代推荐"）

#### 模块8：操作建议
| 操作项 | 内容 |
|--------|------|
| 当前阶段 | [阶段判定] |
| 建议仓位区间 | [X]%–[Y]% |
| 建仓策略 | 分批买入策略 |
| 止损线 | [具体价位或百分比] |
| 止盈策略 | 分批止盈策略 |
（数据不足时给出保守建议，如"建议观望，待数据明朗后再决策"）

---
**风险提示**：以上分析仅为研究参考，不构成投资建议，投资有风险，入市需谨慎。`

async function runModel(AI: any, model: string, messages: Array<{role: string, content: string}>): Promise<string> {
  const response = await AI.run(model, { messages })
  // Workers AI 常见返回格式：{ response: "..." } 或字符串
  const reply = response?.response || (typeof response === 'string' ? response : '')
  if (typeof reply === 'string' && reply.trim().length > 0) {
    return reply
  }
  // 有些模型返回 { choices: [{ message: { content } }] }
  if (response?.choices?.[0]?.message?.content) {
    return response.choices[0].message.content
  }
  throw new Error(`Empty response from model ${model}`)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const body = await context.request.json() as { messages?: Array<{role: string, content: string}>, context?: string }
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonResponse({ ok: false, error: 'messages required' }, 400)
    }

    // 检测股票分析意图
    const lastUserMsg = body.messages.filter(m => m.role === 'user').pop()?.content || ''
    const isStockAnalysis = /(股票|个股|分析|走势|买入|卖出|推荐|行情|诊断|估值|财报|研报|持仓|选股|行业|板块|大盘|A股|港股|美股|股价|涨跌|K线|技术面|基本面|筹码|资金|机构|券商|研报|止盈|止损|建仓|减仓|加仓|仓位|机会|风险|景气|赛道|白马|蓝筹|成长|价值|题材|热点|龙头)/.test(lastUserMsg)
    
    // 注入用户财务上下文和股票分析框架
    const contextStr = body.context ? `\n\n## 当前用户的财务概况\n${body.context}` : ''
    const stockPrompt = isStockAnalysis ? STOCK_ANALYSIS_PROMPT : ''
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + stockPrompt + contextStr },
      ...body.messages
    ]

    // 多模型 fallback：依次尝试，哪个成功用哪个
    const errors: string[] = []
    for (const model of MODEL_LIST) {
      try {
        const reply = await runModel(context.env.AI, model, messages)
        return jsonResponse({ ok: true, data: { reply, model } })
      } catch (e: any) {
        const msg = e?.message || String(e)
        console.warn(`[ai] model ${model} failed: ${msg}`)
        errors.push(`${model}: ${msg}`)
      }
    }

    // 全部失败
    return jsonResponse({
      ok: false,
      error: `所有 AI 模型均失败：${errors.join('; ')}`
    }, 502)
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || 'AI call failed' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
