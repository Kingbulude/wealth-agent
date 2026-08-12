// POST /api/ota/publish
// CI 构建完 bundle 后调用此端点更新 manifest 记录
// 需要 Authorization: Bearer <OTA_PUBLISH_TOKEN>

import { jsonResponse, optionsResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
  OTA_PUBLISH_TOKEN?: string
}

interface PublishBody {
  version: string
  url: string
  checksum: string
  message?: string
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
  // 鉴权：CI 通过 Bearer token 调用
  const authHeader = context.request.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token || !context.env.OTA_PUBLISH_TOKEN || token !== context.env.OTA_PUBLISH_TOKEN) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
  }

  try {
    const body = await context.request.json() as PublishBody

    if (!body.version || !body.url || !body.checksum) {
      return jsonResponse({ ok: false, error: 'version, url, checksum are required' }, 400)
    }

    await ensureTable(context.env.DB)
    const now = new Date().toISOString()

    await context.env.DB.prepare(
      `INSERT OR REPLACE INTO ota_bundles (version, url, checksum, message, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    ).bind(
      body.version,
      body.url,
      body.checksum,
      body.message || null,
      now
    ).run()

    console.log(`[OTA publish] 版本 ${body.version} 已发布`)
    return jsonResponse({ ok: true, version: body.version })
  } catch (e: any) {
    console.error('[OTA publish] error:', e)
    return jsonResponse({ ok: false, error: e.message || String(e) }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
