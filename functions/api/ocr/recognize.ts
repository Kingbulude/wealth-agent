import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

interface Env {
  BAIDU_OCR_API_KEY?: string
  BAIDU_OCR_SECRET_KEY?: string
}

/**
 * 百度 OCR 通用文字识别（高精度版）
 * 文档：https://cloud.baidu.com/doc/OCR/s/Ck3h7y2ia
 * 需要配置环境变量：BAIDU_OCR_API_KEY / BAIDU_OCR_SECRET_KEY
 * 未配置时返回 null，由前端 Tesseract 兜底
 */
async function recognizeWithBaidu(imageBase64: string, env: Env): Promise<string | null> {
  const apiKey = env.BAIDU_OCR_API_KEY
  const secretKey = env.BAIDU_OCR_SECRET_KEY

  if (!apiKey || !secretKey) {
    console.warn('[OCR] Baidu OCR credentials not configured, skipping cloud OCR')
    return null
  }

  try {
    // 1. 获取 access_token
    const tokenResp = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`,
      { method: 'POST' }
    )
    const tokenJson = await tokenResp.json()
    const accessToken = tokenJson.access_token

    if (!accessToken) {
      console.warn('[OCR] Failed to get Baidu OCR access_token')
      return null
    }

    // 2. 调用高精度通用文字识别（accurate_basic）
    //    持仓截图字小、密度高，高精度版识别率显著优于 general_basic
    const resultResp = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `image=${encodeURIComponent(imageBase64)}&language_type=CHN_ENG`
      }
    )

    const resultJson = await resultResp.json()

    if (resultJson.error_code) {
      console.warn(`[OCR] Baidu OCR error: ${resultJson.error_code} ${resultJson.error_msg}`)
      return null
    }

    if (resultJson.words_result && Array.isArray(resultJson.words_result)) {
      return resultJson.words_result.map((item: any) => item.words).join('\n')
    }

    console.warn('[OCR] Baidu OCR returned no words_result')
    return null
  } catch (e) {
    console.warn('[OCR] Baidu OCR failed:', (e as Error).message)
    return null
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const formData = await context.request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return jsonResponse({ ok: false, error: 'No image file provided' }, 400)
    }

    // 大小限制：10MB（百度 OCR 上限）
    if (file.size > 10 * 1024 * 1024) {
      return jsonResponse({ ok: false, error: '图片不能超过 10MB' }, 400)
    }

    const bytes = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(bytes)

    console.log(`[OCR] Received image: ${file.name}, size: ${(bytes.byteLength / 1024).toFixed(1)}KB`)

    // 唯一云端供应商：百度 OCR
    // 之前的腾讯云 / Google Vision / EasyOCR 三个都是死代码：
    //   - 腾讯云：缺 TC3-HMAC-SHA256 V3 签名，永远 401
    //   - Google Vision：URL 没有 ?key=，永远 403
    //   - EasyOCR：api.easyocr.tech 是不存在的公开服务
    // 已全部删除。未配置百度 key 时返回空，由前端 Tesseract 兜底。
    const text = await recognizeWithBaidu(base64, context.env)

    if (!text || text.length === 0) {
      console.warn('[OCR] Baidu OCR returned empty, fallback to client-side Tesseract')
      return jsonResponse({
        ok: true,
        data: { text: '', strategy: 'none' },
        message: '云端 OCR 不可用（未配置百度 OCR 密钥或识别为空），已回退到本地 Tesseract'
      })
    }

    console.log(`[OCR] Baidu success, text length: ${text.length}`)

    return jsonResponse({
      ok: true,
      data: { text, strategy: 'baidu' },
      message: 'OCR 识别完成（百度高精度版）'
    })

  } catch (e: any) {
    console.error('[OCR] Server error:', e)
    return jsonResponse({ ok: false, error: e.message || 'OCR server error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
