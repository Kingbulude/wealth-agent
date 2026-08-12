// POST /api/log/error
// 接收前端错误监控上报，写入 D1 数据库

import { optionsResponse, jsonResponse } from '../../lib/auth'

interface Env {
  DB: D1Database
}

interface ErrorReport {
  message: string
  stack?: string
  source?: string
  line?: number
  column?: number
  url: string
  userAgent: string
  timestamp: number
  type: 'js_error' | 'promise_rejection' | 'console_error' | 'react_error'
  extra?: any
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { reports: ErrorReport[] }
    const reports = body.reports || []

    if (reports.length === 0) {
      return jsonResponse({ ok: true, saved: 0 })
    }

    let saved = 0
    for (const r of reports) {
      try {
        await context.env.DB.prepare(`
          INSERT INTO error_logs (
            message, stack, source, line_no, column_no,
            url, user_agent, timestamp, type, extra
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        `).bind(
          r.message?.slice(0, 500) || '',
          r.stack?.slice(0, 4000) || null,
          r.source?.slice(0, 500) || null,
          r.line || null,
          r.column || null,
          r.url?.slice(0, 500) || '',
          r.userAgent?.slice(0, 500) || '',
          r.timestamp || Date.now(),
          r.type || 'js_error',
          r.extra ? JSON.stringify(r.extra).slice(0, 4000) : null
        ).run()
        saved++
      } catch (e) {
        // 单条失败不影响其他
        console.warn('[error-log] save failed:', (e as Error).message)
      }
    }

    return jsonResponse({ ok: true, saved, total: reports.length })
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || '日志写入失败' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
