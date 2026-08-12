// POST /api/ota/manifest
// Capacitor Updater 自托管 auto-update 端点
// App 启动时插件 POST 到这里，服务端比较版本后返回最新 bundle 信息
//
// 实现方式：直接查询 GitHub Releases API，获取最新的 ota-v* release
// 无需 D1 数据库，简化部署流程
// 文档: https://capgo.app/docs/plugin/self-hosted/auto-update/

import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  GITHUB_TOKEN?: string
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

const GITHUB_REPO = 'Kingbulude/wealth-agent'

async function getLatestOtaRelease(env: Env): Promise<{ tag: string; url: string; checksum: string } | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'wealth-agent-ota'
  }
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`
  }

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`,
      { headers }
    )
    if (!resp.ok) {
      console.warn(`[OTA] GitHub API returned ${resp.status}`)
      return null
    }
    const releases = (await resp.json()) as Array<{
      tag_name: string
      assets: Array<{ name: string; browser_download_url: string }>
      body?: string
    }>

    // 找最新的 ota-v* release
    for (const rel of releases) {
      if (rel.tag_name.startsWith('ota-v')) {
        const zipAsset = rel.assets.find(
          (a) => a.name === 'bundle.zip'
        )
        if (!zipAsset) continue

        const version = rel.tag_name.replace('ota-v', '')

        // 从 release body 解析 checksum
        let checksum = ''
        if (rel.body) {
          const match = rel.body.match(/SHA256[:\s]+([a-f0-9]{64})/i)
          if (match) {
            checksum = match[1]
          }
        }

        return {
          tag: version,
          url: zipAsset.browser_download_url,
          checksum
        }
      }
    }
    return null
  } catch (e) {
    console.warn('[OTA] Failed to fetch GitHub releases:', (e as Error).message)
    return null
  }
}

// Semver 比较：a > b 返回 1，a < b 返回 -1，相等返回 0
function compareSemver(a: string, b: string): number {
  const clean = (s: string) => s.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  const pa = clean(a)
  const pb = clean(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as AppInfos

    const latest = await getLatestOtaRelease(context.env)

    if (!latest) {
      return jsonResponse({ message: 'No OTA release available' })
    }

    // App 当前版本：version_name 是已安装的 OTA 版本号
    // 'builtin' 表示使用 APK 内置版本，没有装过 OTA
    const currentVersion =
      body.version_name === 'builtin' ? body.version_build : body.version_name

    if (compareSemver(latest.tag, currentVersion) <= 0) {
      return jsonResponse({ message: 'Already up to date' })
    }

    // 返回代理下载 URL（而不是 GitHub 直链），确保私有仓库也能下载
    const origin = new URL(context.request.url).origin
    const downloadUrl = `${origin}/api/ota/download?version=${latest.tag}`

    return jsonResponse({
      version: latest.tag,
      url: downloadUrl,
      checksum: latest.checksum ? `sha256:${latest.checksum}` : '',
      message: `OTA update ${latest.tag}`
    })
  } catch (e: any) {
    console.error('[OTA manifest] error:', e)
    return jsonResponse({ message: 'Internal error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
