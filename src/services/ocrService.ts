import { createWorker, PSM, OEM, type Worker } from 'tesseract.js'
import { enhanceForTextRecognition } from './imageProcessor'
import { getApiUrl } from '../utils/apiUrl'
import { useAuthStore } from '../renderer/stores/authStore'

export interface RecognizedHolding {
  name: string
  symbol: string
  quantity: number
  costPrice: number
  currentPrice: number
  marketValue: number
}

export interface OCRResult {
  success: boolean
  holdings: RecognizedHolding[]
  rawText: string
  engine: 'tesseract' | 'cloudflare' | 'hybrid'
  error?: string
  debugInfo?: string
}

const STOCK_CODE_PATTERN = /(?:SH|SZ|sh|sz)?(?:600|601|603|605|688|689|900|000|001|002|003|300|301|200|430|730|780)[0-9]{3}(?!\d)/
const FUND_CODE_PATTERN = /(?:SH|SZ|sh|sz)?(?:50|51|52|15|16|18)[0-9]{4}(?!\d)/
const CHINESE_NAME_PATTERN = /[\u4e00-\u9fa5]{2,15}/
const DECIMAL_PATTERN = /[\d,]+(?:\.\d{1,4})?/

let workerInstance: Worker | null = null
let workerLoading = false
let loadError: Error | null = null

async function getWorker(): Promise<Worker> {
  if (workerInstance) return workerInstance
  if (loadError) throw loadError
  if (workerLoading) {
    let waited = 0
    while (workerLoading && waited < 30000) {
      await new Promise(r => setTimeout(r, 200))
      waited += 200
    }
    if (workerInstance) return workerInstance
    if (loadError) throw loadError
    throw new Error('Worker loading timed out')
  }
  
  workerLoading = true
  try {
    const worker = await createWorker('chi_sim', 1, {
      logger: (m) => {
        if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') {
          console.log('[OCR] Loading:', m.status)
        }
      }
    })
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT_OSD,
      tessedit_ocr_engine_mode: OEM.DEFAULT,
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: '0123456789.，,元SHSZshsz沪深ABCDEFGHIJKLMNOPQRSTUVWXYZ\u4e00-\u9fa5'
    })
    workerInstance = worker
    console.log('[OCR] Worker initialized successfully')
    return workerInstance
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    loadError = err
    console.error('[OCR] Failed to initialize worker:', err.message)
    throw err
  } finally {
    workerLoading = false
  }
}

async function recognizeWithTesseract(imageFile: File): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const worker = await getWorker()
    const result = await worker.recognize(imageFile)
    return { text: result.data.text, success: true }
  } catch (error) {
    return { text: '', success: false, error: error instanceof Error ? error.message : 'Tesseract failed' }
  }
}

async function recognizeWithCloudflare(imageFile: File): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const token = useAuthStore.getState().token
    const formData = new FormData()
    formData.append('image', imageFile)
    
    const response = await fetch(getApiUrl('/ocr/recognize'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || ''}`
      },
      body: formData
    })
    
    if (!response.ok) {
      return { text: '', success: false, error: `HTTP ${response.status}` }
    }
    
    const json = await response.json()
    if (json.ok && json.data?.text) {
      return { text: json.data.text, success: true }
    }
    return { text: '', success: false, error: json.error || 'Cloudflare OCR failed' }
  } catch (error) {
    return { text: '', success: false, error: error instanceof Error ? error.message : 'Cloudflare OCR network error' }
  }
}

export async function recognizePositionScreenshot(imageFile: File): Promise<OCRResult> {
  const debugLines: string[] = []
  
  try {
    debugLines.push(`Starting OCR for file: ${imageFile.name}, size: ${(imageFile.size / 1024).toFixed(1)}KB`)
    
    const startTime = Date.now()
    
    debugLines.push('Step 1: Enhancing image for text recognition...')
    const enhancedFile = await enhanceForTextRecognition(imageFile)
    debugLines.push(`Image enhanced in ${Date.now() - startTime}ms`)
    
    debugLines.push('Step 2: Trying Tesseract.js (local)...')
    const tesseractResult = await recognizeWithTesseract(enhancedFile)
    debugLines.push(`Tesseract result: ${tesseractResult.success ? 'success' : 'failed'} (${tesseractResult.error})`)
    
    let finalText = tesseractResult.text
    let engine: 'tesseract' | 'cloudflare' | 'hybrid' = 'tesseract'
    
    if (!tesseractResult.success || finalText.length < 50) {
      debugLines.push('Step 3: Falling back to Cloudflare OCR API...')
      const cloudflareResult = await recognizeWithCloudflare(enhancedFile)
      debugLines.push(`Cloudflare result: ${cloudflareResult.success ? 'success' : 'failed'} (${cloudflareResult.error})`)
      
      if (cloudflareResult.success && cloudflareResult.text.length > finalText.length) {
        finalText = cloudflareResult.text
        engine = 'cloudflare'
      } else if (cloudflareResult.success && cloudflareResult.text.length > 0) {
        finalText = finalText + '\n' + cloudflareResult.text
        engine = 'hybrid'
      }
    }
    
    debugLines.push(`Recognition completed in ${Date.now() - startTime}ms`)
    debugLines.push(`Raw text length: ${finalText.length} characters`)
    debugLines.push(`Raw text preview:\n${finalText.slice(0, 800)}...`)
    
    const holdings = parsePositionData(finalText)
    debugLines.push(`Parsed ${holdings.length} holdings using ${engine} engine`)
    
    return {
      success: true,
      holdings,
      rawText: finalText,
      engine,
      debugInfo: debugLines.join('\n')
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    debugLines.push(`Error: ${errMsg}`)
    console.error('OCR Error:', debugLines.join('\n'))
    
    return {
      success: false,
      holdings: [],
      rawText: '',
      engine: 'tesseract',
      error: errMsg,
      debugInfo: debugLines.join('\n')
    }
  }
}

function parsePositionData(text: string): RecognizedHolding[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const stockNameKeywords = ['持仓', '股票', '基金', '名称', '证券', '代码', '市场', '操作', '盈亏', '市值']

  debugLog(`Total lines: ${lines.length}`)

  const holdings: RecognizedHolding[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isHeaderLine(line)) continue

    const code = extractCode(line)
    if (!code) continue

    // 名称优先从当前行提取，当前行没有则尝试相邻行
    let name = extractName(line, stockNameKeywords)
    if (!name && i > 0 && !isHeaderLine(lines[i - 1])) {
      name = extractName(lines[i - 1], stockNameKeywords)
    }
    if (!name && i < lines.length - 1 && !isHeaderLine(lines[i + 1])) {
      name = extractName(lines[i + 1], stockNameKeywords)
    }
    if (!name) continue

    // 提取当前行所有数字，按规则和标签分配字段
    const fields = assignFieldsFromLine(line)
    if (fields.quantity <= 0) {
      // 若当前行未识别到数量，尝试在相邻行补充
      const nearbyText = [
        lines[i - 1] || '',
        line,
        lines[i + 1] || ''
      ].join(' ')
      const nearbyFields = assignFieldsFromLine(nearbyText)
      if (nearbyFields.quantity > 0) fields.quantity = nearbyFields.quantity
      if (fields.costPrice <= 0 && nearbyFields.costPrice > 0) fields.costPrice = nearbyFields.costPrice
      if (fields.currentPrice <= 0 && nearbyFields.currentPrice > 0) fields.currentPrice = nearbyFields.currentPrice
      if (fields.marketValue <= 0 && nearbyFields.marketValue > 0) fields.marketValue = nearbyFields.marketValue
    }

    if (fields.quantity <= 0) continue

    holdings.push(completeHolding({
      name,
      symbol: normalizeSymbol(code),
      quantity: fields.quantity,
      costPrice: fields.costPrice,
      currentPrice: fields.currentPrice,
      marketValue: fields.marketValue
    }))
  }

  debugLog(`Parsed holdings: ${JSON.stringify(holdings)}`)
  return holdings
}

function isHeaderLine(line: string): boolean {
  const headerKeywords = [
    '名称', '代码', '持仓', '股票', '基金', '证券', '数量', '成本', '现价',
    '市值', '盈亏', '涨跌幅', '总资产', '总市值', '可用', '冻结', '当日',
    '更新时间', '人民币', '美元', '港币', '港元', '登录', '首页', '行情',
    '交易', '发现', '我的', '持仓盈亏', '当日盈亏', '持仓市值'
  ]
  const pureHeader = /^(名称|代码|持仓|数量|成本|现价|市值|盈亏|涨跌幅|操作)$/
  if (pureHeader.test(line.replace(/\s/g, ''))) return true
  return headerKeywords.some(k => line.startsWith(k) && line.length < 30)
}

function extractCode(line: string): string | null {
  const stockMatch = line.match(STOCK_CODE_PATTERN)
  if (stockMatch) return stockMatch[0]
  const fundMatch = line.match(FUND_CODE_PATTERN)
  if (fundMatch) return fundMatch[0]
  return null
}

function extractName(line: string, keywords: string[]): string | null {
  const nameMatch = line.match(CHINESE_NAME_PATTERN)
  if (!nameMatch) return null
  const name = nameMatch[0]
  if (keywords.some(k => name.includes(k))) return null
  if (/^(市值|成本|现价|盈亏|数量|金额|均价|当前|最新|涨跌幅|收益|可用|冻结|总资产|总市值|持仓市值)/.test(name)) return null
  return name
}

function assignFieldsFromLine(line: string): {
  quantity: number
  costPrice: number
  currentPrice: number
  marketValue: number
} {
  const rawNumbers = line.match(new RegExp(DECIMAL_PATTERN, 'g')) || []
  const numbers = rawNumbers
    .map(n => parseFloat(n.replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0)
    // 排除股票/基金代码（6 位或更长的整数代码）
    .filter(n => {
      if (!Number.isInteger(n)) return true
      const s = String(Math.round(n))
      return !STOCK_CODE_PATTERN.test(s) && !FUND_CODE_PATTERN.test(s)
    })

  const result = {
    quantity: 0,
    costPrice: 0,
    currentPrice: 0,
    marketValue: 0
  }

  // 按行内标签提取
  const quantityMatch = matchLabelledNumber(line, ['数量', '股数', '持仓数量', '持股', '可用'])
  const costMatch = matchLabelledNumber(line, ['成本', '持仓成本', '成本价', '均价', '买入均价'])
  const priceMatch = matchLabelledNumber(line, ['现价', '当前价', '最新价', '市价', '当前价格'])
  const marketValueMatch = matchLabelledNumber(line, ['市值', '持仓市值', '金额', '总市值'])

  if (quantityMatch > 0) result.quantity = Math.round(quantityMatch)
  if (costMatch > 0 && costMatch < 100000) result.costPrice = costMatch
  if (priceMatch > 0 && priceMatch < 100000) result.currentPrice = priceMatch
  if (marketValueMatch > 0) result.marketValue = marketValueMatch

  // 若标签未覆盖，按数值大小和顺序启发式分配
  const remaining = numbers.filter(n => {
    if (quantityMatch > 0 && Math.abs(n - quantityMatch) < 0.01) return false
    if (costMatch > 0 && Math.abs(n - costMatch) < 0.01) return false
    if (priceMatch > 0 && Math.abs(n - priceMatch) < 0.01) return false
    if (marketValueMatch > 0 && Math.abs(n - marketValueMatch) < 0.01) return false
    return true
  })

  // 排序：小数字优先作为价格，整数大数字作为数量/市值
  const sorted = remaining.sort((a, b) => a - b)

  for (const n of sorted) {
    if (result.quantity === 0 && Number.isInteger(n) && n >= 10 && n < 10000000) {
      result.quantity = Math.round(n)
    } else if (result.costPrice === 0 && n > 0 && n < 10000) {
      result.costPrice = n
    } else if (result.currentPrice === 0 && n > 0 && n < 10000) {
      result.currentPrice = n
    } else if (result.marketValue === 0 && n > 1000) {
      result.marketValue = n
    }
  }

  return result
}

function matchLabelledNumber(line: string, labels: string[]): number {
  for (const label of labels) {
    const idx = line.indexOf(label)
    if (idx === -1) continue
    const after = line.slice(idx + label.length)
    const match = after.match(/[\d,]+(?:\.\d{1,4})?/)
    if (match) {
      const val = parseFloat(match[0].replace(/,/g, ''))
      if (!isNaN(val) && val > 0) return val
    }
  }
  return 0
}

function completeHolding(holding: Partial<RecognizedHolding>): RecognizedHolding {
  if (!holding.currentPrice && holding.costPrice) {
    holding.currentPrice = holding.costPrice
  }
  if (!holding.marketValue && holding.quantity && holding.currentPrice) {
    holding.marketValue = holding.quantity * holding.currentPrice
  }
  
  return {
    name: holding.name || '',
    symbol: holding.symbol || '',
    quantity: holding.quantity || 0,
    costPrice: holding.costPrice || 0,
    currentPrice: holding.currentPrice || 0,
    marketValue: holding.marketValue || 0
  }
}

export function matchHoldingBySymbol(symbol: string, existingHoldings: any[]): any | null {
  const normalized = normalizeSymbol(symbol)
  return existingHoldings.find(h => 
    h.symbol === normalized || 
    h.symbol === normalized.replace('SH', '') || 
    h.symbol === normalized.replace('SZ', '') ||
    h.symbol === normalized.replace('SH', '').replace('SZ', '')
  ) || null
}

function normalizeSymbol(code: string): string {
  code = code.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!code.startsWith('SH') && !code.startsWith('SZ')) {
    if (code.length === 6) {
      const num = parseInt(code)
      if (num >= 600000 && num <= 699999) {
        return `SH${code}`
      } else if (num >= 900000 && num <= 999999) {
        return `SH${code}`
      } else {
        return `SZ${code}`
      }
    }
  }
  return code
}

function debugLog(msg: string) {
  if (import.meta.env.DEV) {
    console.log('[OCR Debug]', msg)
  }
}