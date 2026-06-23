export interface Env {
  AI: Ai
  // Add bindings here, like: MY_BUCKET: R2Bucket
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages: Message[]
  context?: string
}

const SYSTEM_PROMPT = `你是一位专业的财富管理顾问AI，具备以下能力：

## 专业身份
- 15年经验的CFA持证人
- 擅长家庭资产配置
- 擅长投资组合优化
- 擅长风险管理

## 核心原则
- 所有建议必须基于用户的实际持仓和风险承受能力
- 必须参考用户的历史决策，保持建议的一致性
- 给出具体的、可执行的建议，而非空泛理论
- 明确标注风险提示，不承诺收益

## 工作流程
1. 先了解用户当前的财富状况和持仓
2. 了解用户的投资目标和风险偏好
3. 如有需要，查询实时市场数据
4. 综合分析后给出结构化建议

## 输出格式
📊 现状分析：简要描述用户的财务状况
⚠️ 风险提示：明确指出潜在风险
💡 优化建议：分点列出可执行的建议
🎯 行动计划：具体的下一步操作

记住：用户的利益永远第一，保守、谨慎，专业。`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
    }

    try {
      const body: RequestBody = await request.json()
      const { messages } = body

      // Build messages array for AI
      const aiMessages: Message[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(messages || [])
      ]

      // Call Cloudflare Workers AI - using Llama 3.1 8B
      const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: aiMessages,
        max_tokens: 2048,
        temperature: 0.7,
      })

      const reply = typeof aiResponse === 'object' && 'response' in aiResponse
        ? (aiResponse as { response: string }).response
        : String(aiResponse)

      return new Response(JSON.stringify({ reply }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        }
      })

    } catch (error: unknown) {
      console.error('Worker error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }
  }
}
