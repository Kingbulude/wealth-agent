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

const SYSTEM_PROMPT = `你是一位专业的财富管理顾问AI（15年经验的CFA持证人），擅长家庭资产配置、投资组合优化和风险管理。

核心原则：
- 所有建议必须基于用户的实际持仓和风险承受能力
- 给出具体的、可执行的建议，而非空泛理论
- 明确标注风险提示，不承诺收益
- 保守、谨慎、专业，用户的利益永远第一

输出格式建议：
📊 现状分析：简要描述用户的财务状况
⚠️ 风险提示：明确指出潜在风险
💡 优化建议：分点列出可执行的建议
🎯 行动计划：具体的下一步操作`

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

    // 注入用户财务上下文
    const contextStr = body.context ? `\n\n## 当前用户的财务概况\n${body.context}` : ''
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + contextStr },
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
