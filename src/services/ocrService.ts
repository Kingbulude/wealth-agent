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

const STOCK_CODE_PATTERN = /(?:SH|SZ|sh|sz)?[0-9]{6}/
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
      },
      cachePath: '/tesseract'
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
  const lines = text.split('\n').filter(line => line.trim())
  const stockNameKeywords = ['持仓', '股票', '基金', '名称', '证券', '代码']
  
  debugLog(`Total lines: ${lines.length}`)
  
  const allMatches: { type: string; value: string; lineIndex: number; lineText: string }[] = []
  
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return
    
    const codeMatch = trimmed.match(STOCK_CODE_PATTERN)
    if (codeMatch) {
      allMatches.push({ type: 'code', value: codeMatch[0], lineIndex: i, lineText: trimmed })
    }
    
    const nameMatch = trimmed.match(CHINESE_NAME_PATTERN)
    if (nameMatch) {
      const name = nameMatch[0]
      const isKeyword = stockNameKeywords.some(k => name.includes(k))
      if (!isKeyword && !trimmed.match(/^(市值|成本|现价|盈亏|数量|金额|均价|当前|最新|涨跌幅|收益|可用|冻结|总资产|总市值|持仓市值)/)) {
        allMatches.push({ type: 'name', value: name, lineIndex: i, lineText: trimmed })
      }
    }
    
    const numberMatches = trimmed.match(new RegExp(DECIMAL_PATTERN, 'g'))
    if (numberMatches) {
      numberMatches.forEach(num => {
        const cleanNum = num.replace(/,/g, '')
        const parsed = parseFloat(cleanNum)
        if (!isNaN(parsed) && parsed > 0) {
          allMatches.push({ type: 'number', value: cleanNum, lineIndex: i, lineText: trimmed })
        }
      })
    }
    
    if (trimmed.includes('数量') || trimmed.includes('股数')) {
      const numMatch = trimmed.match(DECIMAL_PATTERN)
      if (numMatch) {
        allMatches.push({ type: 'quantity', value: numMatch[0].replace(/,/g, ''), lineIndex: i, lineText: trimmed })
      }
    }
    if (trimmed.includes('成本') || trimmed.includes('均价') || trimmed.includes('持仓成本')) {
      const numMatch = trimmed.match(DECIMAL_PATTERN)
      if (numMatch) {
        allMatches.push({ type: 'cost', value: numMatch[0].replace(/,/g, ''), lineIndex: i, lineText: trimmed })
      }
    }
    if (trimmed.includes('现价') || trimmed.includes('当前价') || trimmed.includes('最新价') || trimmed.includes('市价')) {
      const numMatch = trimmed.match(DECIMAL_PATTERN)
      if (numMatch) {
        allMatches.push({ type: 'price', value: numMatch[0].replace(/,/g, ''), lineIndex: i, lineText: trimmed })
      }
    }
    if (trimmed.includes('市值') || trimmed.includes('金额')) {
      const numMatch = trimmed.match(DECIMAL_PATTERN)
      if (numMatch) {
        allMatches.push({ type: 'marketValue', value: numMatch[0].replace(/,/g, ''), lineIndex: i, lineText: trimmed })
      }
    }
  })
  
  debugLog(`All matches: ${JSON.stringify(allMatches)}`)
  
  const groups: RecognizedHolding[] = []
  let currentGroup: Partial<RecognizedHolding> = {}
  let lastLineIndex = -10
  
  for (const match of allMatches) {
    if (match.lineIndex - lastLineIndex > 3 && Object.keys(currentGroup).length > 0) {
      if (currentGroup.name && currentGroup.symbol) {
        groups.push(completeHolding(currentGroup))
      }
      currentGroup = {}
    }
    
    switch (match.type) {
      case 'code':
        currentGroup.symbol = normalizeSymbol(match.value)
        break
      case 'name':
        if (!currentGroup.name) {
          currentGroup.name = match.value
        }
        break
      case 'quantity':
        currentGroup.quantity = Math.round(parseFloat(match.value))
        break
      case 'cost':
        const costVal = parseFloat(match.value)
        if (costVal > 0 && costVal < 100000) {
          currentGroup.costPrice = costVal
        }
        break
      case 'price':
        const priceVal = parseFloat(match.value)
        if (priceVal > 0 && priceVal < 100000) {
          currentGroup.currentPrice = priceVal
        }
        break
      case 'marketValue':
        const mvVal = parseFloat(match.value)
        if (mvVal > 0) {
          currentGroup.marketValue = mvVal
        }
        break
      case 'number':
        const numVal = parseFloat(match.value)
        if (!currentGroup.quantity && numVal > 0 && (Number.isInteger(numVal) || numVal < 1000)) {
          currentGroup.quantity = Math.round(numVal)
        } else if (!currentGroup.costPrice && numVal > 0 && numVal < 10000) {
          currentGroup.costPrice = numVal
        } else if (!currentGroup.currentPrice && numVal > 0 && numVal < 10000) {
          currentGroup.currentPrice = numVal
        }
        break
    }
    
    lastLineIndex = match.lineIndex
  }
  
  if (currentGroup.name && currentGroup.symbol) {
    groups.push(completeHolding(currentGroup))
  }
  
  debugLog(`Parsed groups: ${JSON.stringify(groups)}`)
  
  return groups.filter(h => h.name && h.symbol && h.quantity > 0)
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