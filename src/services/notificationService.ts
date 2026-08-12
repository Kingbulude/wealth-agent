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
const PREF_KEY = 'push_config'

// ==================== 本地降级 ====================
function loadLocalConfig(): PushConfig {
  try {
    return JSON.parse(localStorage.getItem(PUSH_CONFIG_KEY) || '{}')
  } catch {
    return { feishuWebhook: '' }
  }
}

function saveLocalConfig(config: PushConfig): void {
  localStorage.setItem(PUSH_CONFIG_KEY, JSON.stringify(config))
}

// ==================== API 读写 ====================
async function apiGetConfig(): Promise<PushConfig | null> {
  try {
    const { token } = useAuthStore.getState()
    const resp = await fetch(getApiUrl(`/preferences/${PREF_KEY}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!resp.ok) return null
    const json = await resp.json()
    if (json.ok && json.data?.value) {
      return json.data.value as PushConfig
    }
    return null
  } catch {
    return null
  }
}

async function apiSaveConfig(config: PushConfig): Promise<boolean> {
  try {
    const { token } = useAuthStore.getState()
    const resp = await fetch(getApiUrl(`/preferences/${PREF_KEY}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ value: config })
    })
    return resp.ok
  } catch {
    return false
  }
}

// ==================== 对外接口 ====================
export function getPushConfig(): PushConfig {
  // 同步返回本地缓存（用于组件初始渲染）
  return loadLocalConfig()
}

export async function loadPushConfig(): Promise<PushConfig> {
  // 优先从 API 拉取，失败降级到本地
  const apiConfig = await apiGetConfig()
  if (apiConfig) {
    saveLocalConfig(apiConfig)
    return apiConfig
  }
  return loadLocalConfig()
}

export async function savePushConfig(config: PushConfig): Promise<void> {
  // 先写本地，再异步同步到 API
  saveLocalConfig(config)
  const saved = await apiSaveConfig(config)
  if (!saved) {
    console.warn('[push] API 同步失败，已降级到本地存储')
  }
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
    const resp = await fetch(getApiUrl('/notify/feishu'), {
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
    '财富管理智能体推送测试成功！\n\n你可以在设置中配置持仓报告和决策信号的自动推送。'
  )
}

export async function pushDailyReport(): Promise<PushResult> {
  try {
    const { token } = useAuthStore.getState()
    const resp = await fetch(getApiUrl('/notify/daily-report'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
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
