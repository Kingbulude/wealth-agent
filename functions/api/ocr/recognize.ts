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

interface BaiduWord {
  words: string
  location?: { left: number; top: number; width: number; height: number }
}

interface BaiduResult {
  text: string
  words: BaiduWord[]
  raw: any
}

/**
 * 百度 OCR 通用文字识别（高精度版）
 * 文档：https://cloud.baidu.com/doc/OCR/s/Ck3h7y2ia
 * 需要配置环境变量：BAIDU_OCR_API_KEY / BAIDU_OCR_SECRET_KEY
 */
async function recognizeWithBaidu(imageBase64: string, env: Env): Promise<BaiduResult | null> {
  const apiKey = env.BAIDU_OCR_API_KEY
  const secretKey = env.BAIDU_OCR_SECRET_KEY

  if (!apiKey || !secretKey) {
    console.warn('[OCR] Baidu OCR credentials not configured')
    return null
  }

  try {
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

    const resultResp = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `image=${encodeURIComponent(imageBase64)}&language_type=CHN_ENG&detect_direction=true`
      }
    )

    const resultJson = await resultResp.json()

    if (resultJson.error_code) {
      console.warn(`[OCR] Baidu OCR error: ${resultJson.error_code} ${resultJson.error_msg}`)
      return null
    }

    if (resultJson.words_result && Array.isArray(resultJson.words_result)) {
      const words = resultJson.words_result as BaiduWord[]
      const text = words.map(w => w.words).join('\n')
      return { text, words, raw: resultJson }
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

    if (file.size > 10 * 1024 * 1024) {
      return jsonResponse({ ok: false, error: '图片不能超过 10MB' }, 400)
    }

    const bytes = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(bytes)

    console.log(`[OCR] Received image: ${file.name}, size: ${(bytes.byteLength / 1024).toFixed(1)}KB`)

    // 百度 OCR 作为主力引擎（识别率远高于本地 Tesseract）
    // 返回带 bounding box 的结构化结果，前端据此做列式解析
    const baiduResult = await recognizeWithBaidu(base64, context.env)

    if (baiduResult && baiduResult.text.length > 0) {
      console.log(`[OCR] Baidu success, text length: ${baiduResult.text.length}, words: ${baiduResult.words.length}`)
      return jsonResponse({
        ok: true,
        data: {
          text: baiduResult.text,
          words: baiduResult.words,
          strategy: 'baidu',
          hasLocation: baiduResult.words.some(w => w.location)
        },
        message: 'OCR 识别完成（百度高精度版）'
      })
    }

    // 百度不可用时返回空，由前端 Tesseract 兜底
    console.warn('[OCR] Baidu OCR not available, frontend will fallback to Tesseract')
    return jsonResponse({
      ok: true,
      data: { text: '', words: [], strategy: 'none', hasLocation: false },
      message: '云端 OCR 不可用，已回退到本地 Tesseract'
    })

  } catch (e: any) {
    console.error('[OCR] Server error:', e)
    return jsonResponse({ ok: false, error: e.message || 'OCR server error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
