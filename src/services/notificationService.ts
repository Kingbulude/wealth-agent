import { useAuthStore } from '../renderer/stores/authStore'
import { getApiUrl } from '../utils/apiUrl'

export interface PushResult {
  ok: boolean
  message?: string
  error?: string
}

export interface PushConfig {
  feishuWebhook: string
}

const PUSH_CONFIG_KEY = 'wealth_agent_push_config'

export function getPushConfig(): PushConfig {
  try {
    return JSON.parse(localStorage.getItem(PUSH_CONFIG_KEY) || '{}')
  } catch {
    return { feishuWebhook: '' }
  }
}

export function savePushConfig(config: PushConfig): void {
  localStorage.setItem(PUSH_CONFIG_KEY, JSON.stringify(config))
}

export async function sendFeishuPush(
  type: 'portfolio' | 'signal' | 'text',
  content: string,
  title?: string
): Promise<PushResult> {
  const config = getPushConfig()
  if (!config.feishuWebhook) {
    return { ok: false, error: '未配置飞书Webhook，请先在设置中配置' }
  }

  try {
    const { token } = useAuthStore.getState()
    const resp = await fetch('/api/notify/feishu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ type, content, title, webhook: config.feishuWebhook })
    })

    const json = await resp.json()
    if (json.ok) {
      return { ok: true, message: json.message }
    }
    return { ok: false, error: json.error || '推送失败' }
  } catch (e: any) {
    return { ok: false, error: e.message || '推送失败' }
  }
}

export async function testFeishuPush(): Promise<PushResult> {
  return sendFeishuPush(
    'text',
    '财富管理智能体推送测试成功！🎉\n\n你可以在设置中配置持仓报告和决策信号的自动推送。'
  )
}
