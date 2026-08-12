// POST /api/ota/manifest  → CapacitorUpdater 真正调用的端点
// GET  /api/ota/manifest  → 调试端点（浏览器访问，返回 JSON 状态页）
//
// 实现方式：直接查询 GitHub Releases API，获取最新的 ota-v* release
// 无需 D1 数据库，简化部署流程
// 文档: https://capgo.app/docs/plugin/self-hosted/auto-update/

import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  GITHUB_TOKEN?: string
  JWT_SECRET?: string
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

async function fetchGithubReleases(env: Env): Promise<{
  ok: boolean
  status: number
  error?: string
  releases?: Array<any>
}> {
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
      let detail = ''
      try {
        const err = (await resp.json()) as any
        detail = err.message || ''
      } catch { /* ignore */ }
      return {
        ok: false,
        status: resp.status,
        error: detail ? `GitHub ${resp.status}: ${detail}` : `GitHub API returned ${resp.status}`
      }
    }
    const releases = await resp.json() as Array<any>
    return { ok: true, status: 200, releases }
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  }
}

function findLatestOtaRelease(releases: Array<any>): { tag: string; url: string; checksum: string; rawTag: string } | null {
  for (const rel of releases) {
    if (rel.tag_name?.startsWith('ota-v')) {
      const zipAsset = rel.assets?.find((a: any) => a.name === 'bundle.zip')
      if (!zipAsset) continue

      const version = rel.tag_name.replace('ota-v', '')

      let checksum = ''
      if (rel.body) {
        const match = rel.body.match(/SHA256[:\s]+([a-f0-9]{64})/i)
        if (match) checksum = match[1]
      }

      return {
        tag: version,
        url: zipAsset.browser_download_url,
        checksum,
        rawTag: rel.tag_name
      }
    }
  }
  return null
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

/**
 * 浏览器 GET 访问的调试页：一眼看出 OTA 是否工作正常
 * - GitHub API 是否能连上
 * - GITHUB_TOKEN 是否配置
 * - 有没有找到 OTA release
 * - 最新版本号是多少
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const debug: any = {
    service: 'OTA Manifest (debug mode)',
    time: new Date().toISOString(),
    github_repo: GITHUB_REPO,
    github_token_configured: !!context.env.GITHUB_TOKEN,
    jwt_secret_configured: !!(context.env.JWT_SECRET && context.env.JWT_SECRET.length >= 32),
    jwt_secret_length: context.env.JWT_SECRET ? context.env.JWT_SECRET.length : 0
  }

  const result = await fetchGithubReleases(context.env)
  debug.github_api = {
    ok: result.ok,
    status: result.status || 'network_error',
    error: result.error || null
  }

  if (result.ok && result.releases) {
    const latest = findLatestOtaRelease(result.releases)
    const origin = new URL(context.request.url).origin
    debug.latest_ota_release = latest
      ? {
          version: latest.tag,
          tag: latest.rawTag,
          checksum_present: !!latest.checksum,
          checksum_prefix: latest.checksum ? latest.checksum.slice(0, 12) + '...' : null,
          download_proxy_url: `${origin}/api/ota/download?version=${latest.tag}`,
          asset_count: (result.releases.find((r: any) => r.tag_name === latest.rawTag)?.assets || []).length
        }
      : null
    debug.hint = latest
      ? 'OK: 找到 OTA release，App 能正常检查更新'
      : '未找到 ota-v* Release。请确认 build-android.yml workflow 已成功运行并上传了 bundle.zip。'
  } else {
    debug.hint = result.status === 401 || result.status === 403
      ? 'GitHub Token 无效或权限不足（401/403）。请重新生成一个有 repo 权限的 token，填到 Cloudflare Pages 的 GITHUB_TOKEN 环境变量。'
      : 'GitHub API 不可访问。检查是否需要配置 GITHUB_TOKEN 以访问私有仓库。'
  }

  // 浏览器直接访问时返回好看的 HTML
  const ua = context.request.headers.get('User-Agent') || ''
  if (ua.includes('Mozilla') && !ua.includes('curl') && !ua.includes('Postman')) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OTA Status</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:20px;background:#f6f8fa;color:#24292f}
.card{max-width:640px;margin:0 auto;background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:24px}
h1{margin:0 0 16px;font-size:20px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eaeef2}
.row:last-child{border-bottom:0}
.label{color:#57606a;font-size:14px}
.value{font-weight:600;font-size:14px;word-break:break-all;text-align:right;max-width:60%}
.good{color:#1a7f37}.bad{color:#cf222e}.warn{color:#9a6700}
.hint{margin-top:16px;padding:12px 14px;background:#fff8c5;border-left:3px solid #d4a72c;border-radius:4px;font-size:14px;line-height:1.6}
.hint.ok{background:#dafbe1;border-left-color:#2da44e;color:#116329}
.hint.err{background:#ffebe9;border-left-color:#cf222e;color:#82071e}
</style></head><body><div class="card"><h1>📱 OTA 状态面板</h1>
<div class="row"><span class="label">仓库</span><span class="value">${debug.github_repo}</span></div>
<div class="row"><span class="label">检查时间</span><span class="value">${debug.time.replace('T',' ').slice(0,19)}</span></div>
<div class="row"><span class="label">GITHUB_TOKEN 配置</span><span class="value ${debug.github_token_configured?'good':'bad'}">${debug.github_token_configured?'✅ 已配置':'❌ 未配置'}</span></div>
<div class="row"><span class="label">JWT_SECRET 配置</span><span class="value ${debug.jwt_secret_configured?'good':'bad'}">${debug.jwt_secret_configured?'✅ 已配置 ('+debug.jwt_secret_length+' chars)':'❌ 未配置或过短'}</span></div>
<div class="row"><span class="label">GitHub API 状态</span><span class="value ${debug.github_api.ok?'good':'bad'}">${debug.github_api.ok?'✅ 正常 (200)':('❌ '+debug.github_api.status)}</span></div>
${debug.github_api.error?`<div class="row"><span class="label">错误详情</span><span class="value bad">${debug.github_api.error}</span></div>`:''}
<div class="row"><span class="label">最新 OTA 版本</span><span class="value">${debug.latest_ota_release?('v'+debug.latest_ota_release.version):'⚠️ 未找到'}</span></div>
${debug.latest_ota_release?`<div class="row"><span class="label">Checksum</span><span class="value ${debug.latest_ota_release.checksum_present?'good':'warn'}">${debug.latest_ota_release.checksum_present?'✅ '+debug.latest_ota_release.checksum_prefix:'⚠️ 缺失'}</span></div>`:''}
<div class="hint ${debug.github_api.ok && debug.latest_ota_release?'ok':(debug.github_api.ok?'':'err')}">${debug.hint}</div>
</div></body></html>`
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    })
  }

  return jsonResponse(debug)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as AppInfos

    const ghResult = await fetchGithubReleases(context.env)
    if (!ghResult.ok || !ghResult.releases) {
      return jsonResponse({ message: `GitHub API error: ${ghResult.status}`, _debug: ghResult.error }, 502)
    }

    const latest = findLatestOtaRelease(ghResult.releases)
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
    return jsonResponse({ message: 'Internal error', error: e.message }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()

