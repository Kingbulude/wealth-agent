import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'
import { fetchWithAntiCrawler } from '../../lib/anti-crawler'

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

async function recognizeWithBaidu(imageBase64: string, env: Env): Promise<string | null> {
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
      console.warn('[OCR] Failed to get Baidu OCR token')
      return null
    }
    
    const resultResp = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `image=${encodeURIComponent(imageBase64)}&language_type=CHN_ENG`
      }
    )
    
    const resultJson = await resultResp.json()
    if (resultJson.words_result && Array.isArray(resultJson.words_result)) {
      return resultJson.words_result.map((item: any) => item.words).join('\n')
    }
  } catch (e) {
    console.warn('[OCR] Baidu OCR failed:', (e as Error).message)
  }
  return null
}

async function recognizeWithTencent(imageBase64: string): Promise<string | null> {
  try {
    const response = await fetchWithAntiCrawler(
      'https://ocr.tencentcloudapi.com/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'ocr.tencentcloudapi.com',
          'X-TC-Version': '2018-11-19',
          'X-TC-Action': 'GeneralBasicOCR'
        },
        body: JSON.stringify({
          ImageBase64: imageBase64
        })
      },
      10000
    )
    
    const json = await response.json()
    if (json.Response?.TextDetections) {
      return json.Response.TextDetections.map((item: any) => item.DetectedText).join('\n')
    }
  } catch (e) {
    console.warn('[OCR] Tencent OCR failed:', (e as Error).message)
  }
  return null
}

async function recognizeWithGoogle(imageBase64: string): Promise<string | null> {
  try {
    const response = await fetchWithAntiCrawler(
      'https://vision.googleapis.com/v1/images:annotate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        })
      },
      10000
    )
    
    const json = await response.json()
    if (json.responses?.[0]?.fullTextAnnotation?.text) {
      return json.responses[0].fullTextAnnotation.text
    }
  } catch (e) {
    console.warn('[OCR] Google Vision failed:', (e as Error).message)
  }
  return null
}

async function recognizeWithEasyOCR(imageBase64: string): Promise<string | null> {
  try {
    const response = await fetchWithAntiCrawler(
      'https://api.easyocr.tech/ocr',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          languages: ['ch_sim', 'en'],
          detail: 0
        })
      },
      15000
    )
    
    const json = await response.json()
    if (json.result && Array.isArray(json.result)) {
      return json.result.join('\n')
    }
  } catch (e) {
    console.warn('[OCR] EasyOCR API failed:', (e as Error).message)
  }
  return null
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
    
    const bytes = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(bytes)

    console.log(`[OCR] Received image: ${file.name}, size: ${(bytes.byteLength / 1024).toFixed(1)}KB`)

    const strategies = [
      { name: 'baidu', fn: () => recognizeWithBaidu(base64, context.env) },
      { name: 'easyocr', fn: () => recognizeWithEasyOCR(base64) },
      { name: 'tencent', fn: () => recognizeWithTencent(base64) },
      { name: 'google', fn: () => recognizeWithGoogle(base64) }
    ]

    let finalText = ''
    let usedStrategy = 'none'

    for (const { name, fn } of strategies) {
      try {
        const result = await fn()
        if (result && result.length > finalText.length) {
          finalText = result
          usedStrategy = name
        }
      } catch (e) {
        // continue to next strategy
      }
    }
    
    if (finalText.length === 0) {
      console.warn('[OCR] All strategies failed, returning empty')
      return jsonResponse({
        ok: true,
        data: { text: '', strategy: 'none' },
        message: 'All OCR services unavailable, fallback to client-side Tesseract'
      })
    }
    
    console.log(`[OCR] Success with ${usedStrategy}, text length: ${finalText.length}`)
    
    return jsonResponse({
      ok: true,
      data: { text: finalText, strategy: usedStrategy },
      message: `OCR completed using ${usedStrategy} strategy`
    })
    
  } catch (e: any) {
    console.error('[OCR] Server error:', e)
    return jsonResponse({ ok: false, error: e.message || 'OCR server error' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()