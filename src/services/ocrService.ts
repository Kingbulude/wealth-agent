import { createWorker, PSM } from 'tesseract.js'

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
  error?: string
}

const STOCK_CODE_PATTERN = /(?:SH|SZ|sh|sz)?[0-9]{6}/
const CHINESE_NAME_PATTERN = /[\u4e00-\u9fa5]{2,8}/
const DECIMAL_PATTERN = /[\d,]+(?:\.\d{2})?/

export async function recognizePositionScreenshot(imageFile: File): Promise<OCRResult> {
  try {
    const worker = await createWorker('chi_sim', 1, {
      logger: () => {}
    })

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1'
    })

    const result = await worker.recognize(imageFile)
    await worker.terminate()

    const rawText = result.data.text
    const holdings = parsePositionData(rawText)

    return {
      success: true,
      holdings,
      rawText
    }
  } catch (error) {
    return {
      success: false,
      holdings: [],
      rawText: '',
      error: error instanceof Error ? error.message : '识别失败'
    }
  }
}

function parsePositionData(text: string): RecognizedHolding[] {
  const lines = text.split('\n').filter(line => line.trim())
  const holdings: RecognizedHolding[] = []
  let currentHolding: Partial<RecognizedHolding> = {}
  let numbers: number[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    const codeMatch = trimmedLine.match(STOCK_CODE_PATTERN)
    if (codeMatch) {
      if (currentHolding.name && currentHolding.symbol) {
        assignNumbers(currentHolding, numbers)
        holdings.push(currentHolding as RecognizedHolding)
      }
      currentHolding = { symbol: normalizeSymbol(codeMatch[0]) }
      numbers = []
      const nameMatch = trimmedLine.match(CHINESE_NAME_PATTERN)
      if (nameMatch) {
        currentHolding.name = nameMatch[0]
      }
    }

    const nameMatch = trimmedLine.match(CHINESE_NAME_PATTERN)
    if (nameMatch && !currentHolding.name) {
      currentHolding.name = nameMatch[0]
    }

    const decimalMatches = trimmedLine.match(new RegExp(DECIMAL_PATTERN, 'g'))
    if (decimalMatches) {
      for (const match of decimalMatches) {
        const num = parseFloat(match.replace(/,/g, ''))
        if (!isNaN(num)) {
          numbers.push(num)
        }
      }
    }
  }

  if (currentHolding.name && currentHolding.symbol) {
    assignNumbers(currentHolding, numbers)
    holdings.push(currentHolding as RecognizedHolding)
  }

  return holdings.filter(h => h.name && h.symbol && h.quantity > 0)
}

function assignNumbers(holding: Partial<RecognizedHolding>, numbers: number[]) {
  if (numbers.length >= 4) {
    holding.quantity = Math.round(numbers[0])
    holding.costPrice = numbers[1]
    holding.currentPrice = numbers[2]
    holding.marketValue = numbers[3]
  } else if (numbers.length >= 3) {
    holding.quantity = Math.round(numbers[0])
    holding.costPrice = numbers[1]
    holding.currentPrice = numbers[2]
  } else if (numbers.length >= 2) {
    holding.quantity = Math.round(numbers[0])
    holding.costPrice = numbers[1]
  } else if (numbers.length >= 1) {
    holding.quantity = Math.round(numbers[0])
  }
}

function normalizeSymbol(code: string): string {
  code = code.toUpperCase()
  if (!code.startsWith('SH') && !code.startsWith('SZ')) {
    const num = parseInt(code)
    if (num >= 600000 && num <= 699999) {
      return `SH${code}`
    } else {
      return `SZ${code}`
    }
  }
  return code
}

export function matchHoldingBySymbol(symbol: string, existingHoldings: any[]): any | null {
  const normalized = normalizeSymbol(symbol)
  return existingHoldings.find(h => 
    h.symbol === normalized || 
    h.symbol === normalized.replace('SH', '') || 
    h.symbol === normalized.replace('SZ', '')
  ) || null
}