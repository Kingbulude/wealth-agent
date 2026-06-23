// POST /api/ai/chat
// Body: { messages: [{role, content}], context?: string }
// Header: Authorization: Bearer <email>
//
// 代理 Cloudflare Workers AI (Llama 3.1 8B Instruct)
// 注意：Pages Functions 中需绑定 AI binding，变量名 AI

interface Env {
  AI: Ai
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}

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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const email = (context.request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!email) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }

  try {
    const body = await context.request.json() as { messages?: Array<{role: string, content: string}>, context?: string }
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'messages required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      })
    }

    // 注入用户财务上下文
    const contextStr = body.context ? `\n\n## 当前用户的财务概况\n${body.context}` : ''
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + contextStr },
      ...body.messages
    ]

    // 调 Cloudflare Workers AI (Llama 3.1 8B Instruct)
    const response = await (context.env.AI as any).run(
      '@cf/meta/llama-3.1-8b-instruct',
      { messages }
    )

    // Workers AI 默认返回 { response: "..." }
    const reply = (response as any)?.response || (typeof response === 'string' ? response : JSON.stringify(response))

    return new Response(JSON.stringify({ ok: true, data: { reply } }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message || 'AI call failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { headers: CORS_HEADERS })
}
