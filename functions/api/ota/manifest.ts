// POST /api/ota/manifest
// Capacitor Updater 自托管 auto-update 端点
// App 启动时插件 POST app 信息到这里，服务端比较版本后返回最新 bundle 信息
// 文档: https://capgo.app/docs/plugin/self-hosted/auto-update/

import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
}

interface AppInfos {
  platform: 'ios' | 'android'
  device_id: string
  app_id: string
  custom_id?: string
  plugin_version: string
  version_build: string
  version_code: string
  version_name: string
  version_os: string
  is_emulator: boolean
  is_prod: boolean
}

// 简易 semver 比较：a > b 返回 1，a < b 返回 -1，相等返回 0
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

async function ensureTable(db: D1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS ota_bundles (
    version TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    checksum TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL
  )`).run()
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as AppInfos
    await ensureTable(context.env.DB)

    // 查找最新版本
    const { results } = await context.env.DB.prepare(
      `SELECT version, url, checksum, message FROM ota_bundles ORDER BY created_at DESC LIMIT 1`
    ).all()

    if (!results || results.length === 0) {
      // 没有任何 OTA bundle，App 使用内置版本
      return jsonResponse({ message: 'No update available' })
    }

    const latest = results[0] as { version: string; url: string; checksum: string; message?: string }

    // 当前 App 运行的 web 版本：
    // - version_name === 'builtin' 表示没有安装过 OTA 更新，使用的是 APK 内置版本
    // - 否则 version_name 是已安装的 OTA bundle 版本号
    const currentVersion = body.version_name === 'builtin' ? body.version_build : body.version_name

    if (compareSemver(latest.version, currentVersion) <= 0) {
      // 已是最新版本
      return jsonResponse({ message: 'Already up to date' })
    }

    // 有新版本，返回更新信息
    return jsonResponse({
      version: latest.version,
      url: latest.url,
      checksum: latest.checksum,
      message: latest.message || '',
    })
  } catch (e: any) {
    console.error('[OTA manifest] error:', e)
    return jsonResponse({ message: 'Internal error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
