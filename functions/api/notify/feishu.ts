// POST /api/notify/feishu
// 飞书消息推送：持仓报告 / 决策信号通知
// Body: { type: 'portfolio' | 'signal', content: string, title?: string }

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

interface FeishuMessage {
  msg_type: string
  [key: string]: any
}

function buildPortfolioCard(title: string, content: string): FeishuMessage {
  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: title },
        template: 'blue'
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content }
        },
        {
          tag: 'note',
          elements: [
            { tag: 'plain_text', content: '来自 财富管理智能体 · 不构成投资建议' }
          ]
        }
      ]
    }
  }
}

function buildTextMessage(content: string): FeishuMessage {
  return {
    msg_type: 'text',
    content: { text: content }
  }
}

async function sendFeishuWebhook(webhookUrl: string, message: FeishuMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      const text = await response.text()
      return { success: false, error: `HTTP ${response.status}: ${text}` }
    }

    const result = await response.json()
    if (result.code !== 0) {
      return { success: false, error: `飞书错误: ${result.msg || result.code}` }
    }

    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || '请求失败' }
  }
}

// 从用户偏好中获取飞书 webhook
async function getFeishuWebhook(db: D1Database, userId: string): Promise<string | null> {
  try {
    const { results } = await db.prepare(
      `SELECT value FROM preferences WHERE user_id = ? AND key = 'feishu_webhook'`
    ).bind(userId).all()

    if (results && results.length > 0) {
      const row = results[0] as any
      if (row.value) {
        try {
          const parsed = JSON.parse(row.value)
          return parsed.url || parsed.value || row.value
        } catch {
          return row.value
        }
      }
    }
  } catch (e) {
    console.warn('[feishu] 获取 webhook 失败:', e)
  }
  return null
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const { type, content, title, webhook } = await context.request.json()

    if (!type || !content) {
      return jsonResponse({ ok: false, error: 'type and content required' }, 400)
    }

    // 优先使用请求体中的 webhook，其次从数据库获取
    let webhookUrl = webhook || await getFeishuWebhook(context.env.DB, user.id)
    if (!webhookUrl) {
      return jsonResponse({ ok: false, error: '未配置飞书 webhook，请先在设置中配置' }, 400)
    }

    // 构建消息
    let message: FeishuMessage
    if (type === 'portfolio') {
      message = buildPortfolioCard(title || '持仓报告', content)
    } else if (type === 'signal') {
      message = buildPortfolioCard(title || '决策信号', content)
    } else {
      message = buildTextMessage(content)
    }

    // 发送
    const result = await sendFeishuWebhook(webhookUrl, message)

    if (!result.success) {
      return jsonResponse({ ok: false, error: result.error }, 502)
    }

    return jsonResponse({ ok: true, message: '推送成功' })

  } catch (e: any) {
    console.error('[feishu] 推送错误:', e)
    return jsonResponse({ ok: false, error: e.message || '推送失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
