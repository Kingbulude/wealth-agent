// GET /api/ota/download?version=1.2.3
// OTA bundle 下载代理：从 GitHub Release 获取 bundle.zip，流式返回给 App
// 这样即使仓库是私有的，App 也能通过代理下载，无需 GitHub 凭证

import { jsonResponse } from '../../lib/auth'

interface Env {
  GITHUB_TOKEN?: string
}

const GITHUB_REPO = 'Kingbulude/wealth-agent'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const version = url.searchParams.get('version')

  if (!version) {
    return jsonResponse({ error: 'version parameter is required' }, 400)
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'wealth-agent-ota'
  }
  if (context.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${context.env.GITHUB_TOKEN}`
  }

  try {
    // 查找对应的 OTA release
    const releasesResp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`,
      { headers }
    )
    if (!releasesResp.ok) {
      return jsonResponse({ error: `GitHub API error: ${releasesResp.status}` }, 502)
    }

    const releases = (await releasesResp.json()) as Array<{
      tag_name: string
      assets: Array<{ name: string; url: string }>
    }>

    const tagName = `ota-v${version}`
    const release = releases.find((r) => r.tag_name === tagName)
    if (!release) {
      return jsonResponse({ error: `Release ${tagName} not found` }, 404)
    }

    const zipAsset = release.assets.find((a) => a.name === 'bundle.zip')
    if (!zipAsset) {
      return jsonResponse({ error: 'bundle.zip not found in release' }, 404)
    }

    // 用 GitHub API 的 asset URL 下载（带 token 鉴权）
    const downloadHeaders: Record<string, string> = {
      Accept: 'application/octet-stream',
      'User-Agent': 'wealth-agent-ota'
    }
    if (context.env.GITHUB_TOKEN) {
      downloadHeaders.Authorization = `Bearer ${context.env.GITHUB_TOKEN}`
    }

    const assetResp = await fetch(zipAsset.url, {
      headers: downloadHeaders,
      redirect: 'follow'
    })

    if (!assetResp.ok || !assetResp.body) {
      return jsonResponse({ error: `Failed to download bundle: ${assetResp.status}` }, 502)
    }

    // 设置下载响应头
    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', 'application/zip')
    responseHeaders.set('Content-Disposition', `attachment; filename="bundle.zip"`)
    responseHeaders.set('Cache-Control', 'no-store')

    return new Response(assetResp.body as BodyInit, {
      status: 200,
      headers: responseHeaders
    })
  } catch (e: any) {
    console.error('[OTA download] error:', e)
    return jsonResponse({ error: e.message || 'Download failed' }, 500)
  }
}
