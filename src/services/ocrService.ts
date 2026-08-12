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

interface BaiduWord {
  words: string
  location?: { left: number; top: number; width: number; height: number }
}

interface OCRResult {
  success: boolean
  holdings: RecognizedHolding[]
  rawText: string
  engine: 'baidu' | 'tesseract' | 'hybrid'
  hasLocation: boolean
  words?: BaiduWord[]
  error?: string
  debugInfo?: string
}

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
      preserve_interword_spaces: '1'
    })
    workerInstance = worker
    return workerInstance
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    loadError = err
    throw err
  } finally {
    workerLoading = false
  }
}

async function recognizeWithTesseract(imageFile: File): Promise<{ text: string; success: boolean }> {
  try {
    const worker = await getWorker()
    const result = await worker.recognize(imageFile)
    return { text: result.data.text, success: true }
  } catch {
    return { text: '', success: false }
  }
}

interface BaiduOcrApiResponse {
  ok: boolean
  data?: {
    text: string
    words: BaiduWord[]
    strategy: string
    hasLocation: boolean
  }
  error?: string
  message?: string
}

async function recognizeWithBaidu(imageFile: File): Promise<{
  text: string
  words: BaiduWord[]
  hasLocation: boolean
  success: boolean
  error?: string
}> {
  try {
    const token = useAuthStore.getState().token
    const formData = new FormData()
    formData.append('image', imageFile)

    const response = await fetch(getApiUrl('/ocr/recognize'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token || ''}` },
      body: formData
    })

    if (!response.ok) {
      return { text: '', words: [], hasLocation: false, success: false, error: `HTTP ${response.status}` }
    }

    const json = (await response.json()) as BaiduOcrApiResponse
    if (json.ok && json.data) {
      return {
        text: json.data.text,
        words: json.data.words || [],
        hasLocation: json.data.hasLocation,
        success: true
      }
    }
    return { text: '', words: [], hasLocation: false, success: false, error: json.error }
  } catch (error) {
    return {
      text: '',
      words: [],
      hasLocation: false,
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

/**
 * 持仓截图识别主入口
 *
 * 流程：
 * 1. 图像自适应增强（暗色检测 + 反色 + 放大 + 去噪锐化）
 * 2. 百度 OCR（主力，带 bounding box 位置信息）
 * 3. 失败则回退本地 Tesseract
 * 4. 优先用位置信息做列式解析；没有位置则回退到基于文本行的解析
 */
export async function recognizePositionScreenshot(imageFile: File): Promise<OCRResult> {
  const debugLines: string[] = []

  try {
    const startTime = Date.now()
    debugLines.push(`[OCR] Start: ${imageFile.name}, ${(imageFile.size / 1024).toFixed(1)}KB`)

    const enhancedFile = await enhanceForTextRecognition(imageFile)
    debugLines.push(`[OCR] Enhanced in ${Date.now() - startTime}ms`)

    // 1) 百度 OCR（主力）
    const baiduResult = await recognizeWithBaidu(enhancedFile)
    debugLines.push(
      `[OCR] Baidu: ${baiduResult.success ? 'OK' : 'FAIL'} textLen=${baiduResult.text.length} words=${baiduResult.words.length}`
    )

    if (baiduResult.success && baiduResult.text.length > 0) {
      // 2) 优先：基于位置的列式解析
      if (baiduResult.hasLocation && baiduResult.words.length > 0) {
        const holdings = parseHoldingsByLocation(baiduResult.words)
        debugLines.push(`[OCR] Parsed ${holdings.length} holdings by location`)
        return {
          success: true,
          holdings,
          rawText: baiduResult.text,
          engine: 'baidu',
          hasLocation: true,
          words: baiduResult.words,
          debugInfo: debugLines.join('\n')
        }
      }

      // 3) 百度有文字但没 location，回退到文本行解析
      const holdings = parsePositionData(baiduResult.text)
      debugLines.push(`[OCR] Parsed ${holdings.length} holdings by text (no location)`)
      return {
        success: true,
        holdings,
        rawText: baiduResult.text,
        engine: 'baidu',
        hasLocation: false,
        words: baiduResult.words,
        debugInfo: debugLines.join('\n')
      }
    }

    // 4) 百度失败，回退本地 Tesseract
    const tessResult = await recognizeWithTesseract(enhancedFile)
    debugLines.push(`[OCR] Tesseract: ${tessResult.success ? 'OK' : 'FAIL'} textLen=${tessResult.text.length}`)

    if (tessResult.success && tessResult.text.length > 0) {
      const holdings = parsePositionData(tessResult.text)
      debugLines.push(`[OCR] Parsed ${holdings.length} holdings by Tesseract text`)
      return {
        success: true,
        holdings,
        rawText: tessResult.text,
        engine: 'tesseract',
        hasLocation: false,
        debugInfo: debugLines.join('\n')
      }
    }

    return {
      success: false,
      holdings: [],
      rawText: '',
      engine: 'tesseract',
      hasLocation: false,
      error: 'OCR 识别失败：百度和本地 Tesseract 均未返回有效文字',
      debugInfo: debugLines.join('\n')
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      holdings: [],
      rawText: '',
      engine: 'tesseract',
      hasLocation: false,
      error: errMsg,
      debugInfo: [...debugLines, `[OCR] Error: ${errMsg}`].join('\n')
    }
  }
}

// ==================== 基于位置的列式解析 ====================
// 思路：将所有 word 按 top（y 坐标）聚类成行，行内按 left（x 坐标）排序，
// 识别"名称 / 代码 / 数量 / 成本 / 现价 / 市值"各列的 x 范围，然后逐行组装。

interface Word extends BaiduWord {
  left: number
  top: number
  width: number
  height: number
}

interface Row {
  top: number
  bottom: number
  words: Word[]
}

const QTY_HEADER_RE = /数量|股数|持仓量/
const MV_HEADER_RE = /市值|金额|持仓市值/

function parseHoldingsByLocation(words: BaiduWord[]): RecognizedHolding[] {
  if (words.length === 0) return []

  const validWords: Word[] = []
  for (const w of words) {
    if (w.location) {
      validWords.push({
        words: w.words,
        left: w.location.left,
        top: w.location.top,
        width: w.location.width,
        height: w.location.height
      })
    }
  }
  if (validWords.length === 0) return []

  const rows = clusterIntoRows(validWords)
  if (rows.length === 0) return []

  // 统一使用行级名称检测 + 全量数字提取
  // 不假设 2 行配对，避免 clusterIntoRows 容差导致的配对失败
  return parseRowsByName(rows)
}

// ==================== 行级名称检测 + 全量数字提取 ====================
// 策略：
// 1. 找包含 2-4 个中文字（股票名）且不含表头关键字的行
// 2. 对每个名称行，收集该行 + 下一行的所有数字
//    （若下一行也是名称行，即 1 行/股票布局，则不合并下一行）
// 3. 从合并的数字中提取：
//    - 数量：最大整数且 >= 100
//    - 市值：最大小数且 >= 1000
//    - 现价和成本价：最小的两个 > 0.5 的小数

function parseRowsByName(rows: Row[]): RecognizedHolding[] {
  const headerRegex = /(成本|均价|现价|当前|最新|市价|数量|股数|持仓量|市值|金额|持仓市值|名称|证券|股票|代码|证券代码|盈亏|可用|涨跌幅|收益|冻结|总资产|总市值)/

  const isNameRow = (row: Row): boolean => {
    const text = row.words.map(w => w.words).join('')
    const chineseMatches = text.match(/[\u4e00-\u9fa5]{2,4}/g)
    if (!chineseMatches || chineseMatches.length === 0) return false
    if (headerRegex.test(text)) return false
    if (!/\d/.test(text)) return false
    return true
  }

  const nameRowIndices: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (isNameRow(rows[i])) nameRowIndices.push(i)
  }

  if (nameRowIndices.length === 0) return []

  const holdings: RecognizedHolding[] = []

  for (const idx of nameRowIndices) {
    const rowA = rows[idx]

    // 收集该行 + 下一行的所有数字
    // 如果下一行也是名称行（下一只股票），则不合并 —— 即名称行本身已是合并行
    const collectedRows: Row[] = [rowA]
    if (idx + 1 < rows.length && !isNameRow(rows[idx + 1])) {
      collectedRows.push(rows[idx + 1])
    }

    // 提取名称：2-4 个中文字
    const rowAText = rowA.words.map(w => w.words).join('')
    const nameMatch = rowAText.match(/[\u4e00-\u9fa5]{2,4}/)
    if (!nameMatch) continue
    const name = nameMatch[0]

    // 合并所有数字
    const combinedText = collectedRows.map(r => r.words.map(w => w.words).join(' ')).join(' ')

    // 提取小数（价格、市值）和整数（数量）
    const decimalMatches = combinedText.match(/[\d,]+\.\d{1,4}/g) || []
    const intMatches = combinedText.match(/\b\d{2,10}\b/g) || []

    const decimals = decimalMatches
      .map(s => parseFloat(s.replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0)
    const ints = intMatches
      .map(s => parseInt(s.replace(/,/g, ''), 10))
      .filter(n => !isNaN(n))

    // 数量：最大整数且 >= 100
    let quantity = 0
    const goodInts = ints.filter(n => n >= 100 && n < 10000000)
    if (goodInts.length > 0) quantity = Math.max(...goodInts)

    // 市值：最大小数且 >= 1000
    let marketValue = 0
    const bigDecimals = decimals.filter(n => n >= 1000)
    if (bigDecimals.length > 0) marketValue = Math.max(...bigDecimals)

    // 现价和成本价：最小的两个 > 0.5 的小数
    let costPrice = 0
    let currentPrice = 0
    const smallDecimals = decimals.filter(n => n > 0.5).sort((a, b) => a - b)
    if (smallDecimals.length >= 2) {
      currentPrice = smallDecimals[0]
      costPrice = smallDecimals[1]
    } else if (smallDecimals.length === 1) {
      currentPrice = smallDecimals[0]
      costPrice = smallDecimals[0]
    }

    // 反推缺失字段
    if (quantity === 0 && marketValue > 0 && currentPrice > 0) {
      quantity = Math.round(marketValue / currentPrice)
    }
    if (marketValue === 0 && quantity > 0 && currentPrice > 0) {
      marketValue = quantity * currentPrice
    }
    if (!costPrice && currentPrice) costPrice = currentPrice
    if (!currentPrice && costPrice) currentPrice = costPrice

    if (name && (quantity > 0 || costPrice > 0 || currentPrice > 0 || marketValue > 0)) {
      holdings.push({
        name,
        symbol: '',
        quantity,
        costPrice,
        currentPrice,
        marketValue
      })
    }
  }

  return deduplicateHoldings(holdings)
}

function clusterIntoRows(words: Word[]): Row[] {
  const sorted = [...words].sort((a, b) => a.top - b.top || a.left - b.left)
  const rows: Row[] = []

  for (const w of sorted) {
    let placed = false
    for (const row of rows) {
      // 如果 word 的 top 落在行的 y 范围内（允许 30% 行高的容差），归为同一行
      // 降低容差避免财通证券 2 行/股票布局被错误合并成 1 行
      const tolerance = Math.max(8, (row.bottom - row.top) * 0.3)
      if (w.top >= row.top - tolerance && w.top <= row.bottom + tolerance) {
        row.words.push(w)
        row.top = Math.min(row.top, w.top)
        row.bottom = Math.max(row.bottom, w.top + w.height)
        placed = true
        break
      }
    }
    if (!placed) {
      rows.push({ top: w.top, bottom: w.top + w.height, words: [w] })
    }
  }

  for (const row of rows) {
    row.words.sort((a, b) => a.left - b.left)
  }
  return rows
}

function deduplicateHoldings(holdings: RecognizedHolding[]): RecognizedHolding[] {
  const map = new Map<string, RecognizedHolding>()
  for (const h of holdings) {
    const key = `${h.symbol}_${h.name}`
    const existing = map.get(key)
    if (!existing || h.quantity > existing.quantity) {
      map.set(key, h)
    }
  }
  return Array.from(map.values())
}

// ==================== 基于文本行的解析（兜底） ====================

const STOCK_CODE_PATTERN = /(?:SH|SZ|sh|sz)?[0-9]{6}/
const CHINESE_NAME_PATTERN = /[\u4e00-\u9fa5]{2,15}/
const DECIMAL_PATTERN = /[\d,]+(?:\.\d{1,4})?/

// ==================== 纯文本 2行/股票 解析 ====================
// 财通证券等布局（无坐标、仅文本时）：
//   Row A: 同有科技  -46,896.48  5200  39.734
//   Row B: 159,848.00  -22.640%  5200  30.740
// 每只股票占连续两行，顺序是 [名称 盈亏 持仓 成本] + [市值 盈亏% 可用 现价]
// 或者更宽松：任意两行组合，其中上一行有中文名称+若干数字

function parseTwoRowText(text: string): RecognizedHolding[] {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const holdings: RecognizedHolding[] = []

  const headerRegex = /(持仓|名称|代码|市值|成本|现价|盈亏|数量|可用|首页|交易|资讯|自选|买入|卖出|撤单|查询|管理|批量|止盈|止损)/

  const isNameLine = (line: string): boolean => {
    const nameMatch = line.match(/[\u4e00-\u9fa5]{2,4}/)
    if (!nameMatch) return false
    if (headerRegex.test(line)) return false
    if (!/\d/.test(line)) return false
    return true
  }

  // 1) 找到所有"名称行"：包含 2-4 个中文字（股票名）且有数字的行
  const nameRowIdxs: number[] = []
  for (let i = 0; i < rawLines.length; i++) {
    if (isNameLine(rawLines[i])) nameRowIdxs.push(i)
  }

  // 2) 每个名称行：如果下一行也是名称行（下一只股票），不合并；否则合并下一行
  for (const idx of nameRowIdxs) {
    const rowA = rawLines[idx]
    let rowB = ''
    if (idx + 1 < rawLines.length && !isNameLine(rawLines[idx + 1])) {
      rowB = rawLines[idx + 1]
    }
    const combined = rowA + ' ' + rowB

    // 提取名称：2-4 个中文字
    const nameMatch = rowA.match(/[\u4e00-\u9fa5]{2,4}/)
    if (!nameMatch) continue
    const name = nameMatch[0]

    // 收集所有小数（价格、市值）和整数（数量）
    const allNums = combined.match(/[\d,]+\.\d{1,4}/g) || []
    const allInts = combined.match(/\b\d{2,10}\b/g) || []
    const nums = allNums
      .map(s => parseFloat(s.replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0)
    const ints = allInts
      .map(s => parseInt(s.replace(/,/g, ''), 10))
      .filter(n => !isNaN(n))

    // 数量：最大整数且 >= 100
    let quantity = 0
    const goodInts = ints.filter(n => n >= 100 && n < 10000000)
    if (goodInts.length > 0) quantity = Math.max(...goodInts)

    // 市值：最大小数且 >= 1000
    let marketValue = 0
    const bigDecimals = nums.filter(n => n >= 1000)
    if (bigDecimals.length > 0) marketValue = Math.max(...bigDecimals)

    // 现价和成本价：最小的两个 > 0.5 的小数
    let costPrice = 0
    let currentPrice = 0
    const smallDecimals = nums.filter(n => n > 0.5).sort((a, b) => a - b)
    if (smallDecimals.length >= 2) {
      currentPrice = smallDecimals[0]
      costPrice = smallDecimals[1]
    } else if (smallDecimals.length === 1) {
      currentPrice = smallDecimals[0]
      costPrice = smallDecimals[0]
    }

    // 反推缺失字段
    if (quantity === 0 && marketValue > 0 && currentPrice > 0) {
      quantity = Math.round(marketValue / currentPrice)
    }
    if (marketValue === 0 && quantity > 0 && currentPrice > 0) {
      marketValue = quantity * currentPrice
    }
    if (!costPrice && currentPrice) costPrice = currentPrice
    if (!currentPrice && costPrice) currentPrice = costPrice

    if (name && (quantity > 0 || costPrice > 0 || currentPrice > 0 || marketValue > 0)) {
      holdings.push({
        name,
        symbol: '',
        quantity,
        costPrice,
        currentPrice,
        marketValue
      })
    }
  }

  return deduplicateHoldings(holdings)
}

function parsePositionData(text: string): RecognizedHolding[] {
  // 优先：纯文本模式下的 2行/股票 解析（财通证券等通用布局）
  const twoRow = parseTwoRowText(text)
  if (twoRow.length > 0) return twoRow

  // 回退：单行解析（放宽条件，允许无代码）
  const lines = text.split('\n').filter(line => line.trim())
  const stockNameKeywords = ['持仓', '股票', '基金', '名称', '证券', '代码']

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
      if (!isKeyword && !/^(市值|成本|现价|盈亏|数量|金额|均价|当前|最新|涨跌幅|收益|可用|冻结|总资产|总市值|持仓市值)/.test(trimmed)) {
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

    if (QTY_HEADER_RE.test(trimmed)) {
      const numMatch = trimmed.match(DECIMAL_PATTERN)
      if (numMatch) {
        allMatches.push({ type: 'quantity', value: numMatch[0].replace(/,/g, ''), lineIndex: i, lineText: trimmed })
      }
    }
    if (/成本|均价|持仓成本/.test(trimmed)) {
      const numMatch = trimmed.match(DECIMAL_PATTERN)
      if (numMatch) {
        allMatches.push({ type: 'cost', value: numMatch[0].replace(/,/g, ''), lineIndex: i, lineText: trimmed })
      }
    }
    if (/现价|当前价|最新价|市价/.test(trimmed)) {
      const numMatch = trimmed.match(DECIMAL_PATTERN)
      if (numMatch) {
        allMatches.push({ type: 'price', value: numMatch[0].replace(/,/g, ''), lineIndex: i, lineText: trimmed })
      }
    }
    if (MV_HEADER_RE.test(trimmed)) {
      const numMatch = trimmed.match(DECIMAL_PATTERN)
      if (numMatch) {
        allMatches.push({ type: 'marketValue', value: numMatch[0].replace(/,/g, ''), lineIndex: i, lineText: trimmed })
      }
    }
  })

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
      case 'cost': {
        const costVal = parseFloat(match.value)
        if (costVal > 0 && costVal < 100000) {
          currentGroup.costPrice = costVal
        }
        break
      }
      case 'price': {
        const priceVal = parseFloat(match.value)
        if (priceVal > 0 && priceVal < 100000) {
          currentGroup.currentPrice = priceVal
        }
        break
      }
      case 'marketValue': {
        const mvVal = parseFloat(match.value)
        if (mvVal > 0) {
          currentGroup.marketValue = mvVal
        }
        break
      }
      case 'number': {
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
    }

    lastLineIndex = match.lineIndex
  }

  if (Object.keys(currentGroup).length > 0) {
    if (currentGroup.name) {
      groups.push(completeHolding(currentGroup))
    }
  }

  // 放宽条件：只要有名称+数量/价格之一即可
  const validGroups = groups.filter(h => h.name && (h.quantity > 0 || h.costPrice > 0 || h.currentPrice > 0))
  return deduplicateHoldings(validGroups)
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
  return (
    existingHoldings.find(
      (h: any) =>
        h.symbol === normalized ||
        h.symbol === normalized.replace('SH', '') ||
        h.symbol === normalized.replace('SZ', '') ||
        h.symbol === normalized.replace('SH', '').replace('SZ', '')
    ) || null
  )
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
