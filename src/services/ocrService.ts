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
  debugLog(`Full text:\n${text}`)

  const holdings: RecognizedHolding[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isHeaderLine(line)) continue

    const name = extractName(line, stockNameKeywords)
    if (!name) continue

    debugLog(`Found stock name at line ${i}: "${name}"`)

    // 获取当前行和下一行的数字（券商持仓通常两行一组）
    const currentNumbers = extractNumbersFromLine(line)
    const nextLineNumbers = i + 1 < lines.length ? extractNumbersFromLine(lines[i + 1]) : []
    
    const allNumbers = [...currentNumbers, ...nextLineNumbers]
    debugLog(`Numbers for "${name}": ${JSON.stringify(allNumbers)}`)

    if (allNumbers.length === 0) {
      debugLog(`No numbers found for "${name}", skipping`)
      continue
    }

    // 解析两行一组的持仓数据格式
    const parsed = parseTwoLineHolding(name, currentNumbers, nextLineNumbers)
    
    if (parsed.quantity <= 0) {
      // 如果两行模式没解析出数量，尝试单行模式
      const singleLineParsed = parseSingleLineHolding(name, allNumbers)
      if (singleLineParsed.quantity > 0) {
        parsed.quantity = singleLineParsed.quantity
        parsed.costPrice = singleLineParsed.costPrice || parsed.costPrice
        parsed.currentPrice = singleLineParsed.currentPrice || parsed.currentPrice
        parsed.marketValue = singleLineParsed.marketValue || parsed.marketValue
      }
    }

    // 如果还是没有数量，尝试从数字中找合理的数量
    if (parsed.quantity <= 0) {
      for (const num of allNumbers) {
        if (Number.isInteger(num) && num >= 10 && num <= 1000000) {
          parsed.quantity = num
          break
        }
      }
    }

    if (parsed.quantity <= 0) {
      debugLog(`No valid quantity for "${name}", skipping`)
      continue
    }

    // 尝试从相邻行找代码
    let code = extractCode(line)
    if (!code && i > 0) code = extractCode(lines[i - 1])
    if (!code && i + 1 < lines.length) code = extractCode(lines[i + 1])
    if (!code && i + 2 < lines.length) code = extractCode(lines[i + 2])

    holdings.push(completeHolding({
      name,
      symbol: code ? normalizeSymbol(code) : '',
      quantity: parsed.quantity,
      costPrice: parsed.costPrice,
      currentPrice: parsed.currentPrice,
      marketValue: parsed.marketValue
    }))

    // 如果是两行一组，跳过下一行
    if (nextLineNumbers.length > 0 && !isHeaderLine(lines[i + 1])) {
      i++
    }
  }

  debugLog(`Parsed holdings: ${JSON.stringify(holdings)}`)
  return holdings
}

function extractNumbersFromLine(line: string): number[] {
  const rawMatches = line.match(new RegExp(DECIMAL_PATTERN, 'g')) || []
  const numbers: number[] = []
  
  for (const match of rawMatches) {
    const cleaned = match.replace(/,/g, '')
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed) && !isNaN(parsed)) {
      numbers.push(parsed)
    }
  }
  
  return numbers
}

function parseTwoLineHolding(name: string, firstLine: number[], secondLine: number[]): {
  quantity: number
  costPrice: number
  currentPrice: number
  marketValue: number
} {
  const result = { quantity: 0, costPrice: 0, currentPrice: 0, marketValue: 0 }
  
  // 典型券商持仓格式：
  // 第一行：盈亏金额, 持仓数量, 成本价
  // 第二行：市值, 盈亏比例(%), 可用数量, 现价
  
  // 从第一行提取
  if (firstLine.length >= 2) {
    // 找整数数量（持仓数量通常是整数）
    const intNumbers = firstLine.filter(n => Number.isInteger(n) && n > 0)
    if (intNumbers.length > 0) {
      result.quantity = Math.round(intNumbers[0])
    }
    
    // 找成本价（通常是1-1000之间的小数）
    const priceCandidates = firstLine.filter(n => n > 0 && n <= 10000 && !Number.isInteger(n))
    if (priceCandidates.length > 0) {
      result.costPrice = priceCandidates[0]
    }
  }
  
  // 从第二行提取
  if (secondLine.length >= 2) {
    // 找市值（最大的正数，通常大于1000）
    const largeNumbers = secondLine.filter(n => n > 1000)
    if (largeNumbers.length > 0) {
      result.marketValue = Math.max(...largeNumbers)
    }
    
    // 找现价（通常是1-1000之间的小数，且与成本价接近）
    const priceCandidates = secondLine.filter(n => n > 0 && n <= 10000)
    if (priceCandidates.length > 0) {
      // 优先选与成本价接近的
      if (result.costPrice > 0) {
        const closest = priceCandidates.reduce((prev, curr) => 
          Math.abs(curr - result.costPrice) < Math.abs(prev - result.costPrice) ? curr : prev
        )
        result.currentPrice = closest
      } else {
        result.currentPrice = priceCandidates[0]
      }
    }
    
    // 如果第一行没找到数量，从第二行找
    if (result.quantity <= 0) {
      const intNumbers = secondLine.filter(n => Number.isInteger(n) && n > 0)
      if (intNumbers.length > 0) {
        result.quantity = Math.round(intNumbers[0])
      }
    }
  }
  
  // 如果市值为空，用数量*现价计算
  if (result.marketValue <= 0 && result.quantity > 0 && result.currentPrice > 0) {
    result.marketValue = result.quantity * result.currentPrice
  }
  
  debugLog(`Two-line parse for "${name}": ${JSON.stringify(result)}`)
  return result
}

function parseSingleLineHolding(name: string, numbers: number[]): {
  quantity: number
  costPrice: number
  currentPrice: number
  marketValue: number
} {
  const result = { quantity: 0, costPrice: 0, currentPrice: 0, marketValue: 0 }
  
  if (numbers.length === 0) return result
  
  // 排序：从小到大
  const sorted = [...numbers].sort((a, b) => a - b)
  
  // 找数量：整数，>=10
  const quantities = sorted.filter(n => Number.isInteger(n) && n >= 10 && n <= 1000000)
  if (quantities.length > 0) {
    result.quantity = Math.round(quantities[0])
  }
  
  // 找价格：1-10000之间，非整数优先
  const prices = sorted.filter(n => n > 0 && n <= 10000)
  if (prices.length >= 2) {
    // 两个价格：成本价和现价
    result.costPrice = prices[0]
    result.currentPrice = prices[1]
  } else if (prices.length === 1) {
    result.costPrice = prices[0]
    result.currentPrice = prices[0]
  }
  
  // 找市值：最大的数，>1000
  const largeNumbers = sorted.filter(n => n > 1000)
  if (largeNumbers.length > 0) {
    result.marketValue = largeNumbers[largeNumbers.length - 1]
  }
  
  // 如果市值为空，用数量*现价计算
  if (result.marketValue <= 0 && result.quantity > 0 && result.currentPrice > 0) {
    result.marketValue = result.quantity * result.currentPrice
  }
  
  debugLog(`Single-line parse for "${name}": ${JSON.stringify(result)}`)
  return result
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