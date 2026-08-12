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

const STOCK_CODE_RE = /^(?:SH|SZ|sh|sz)?\d{6}$/
const CODE_LIKE_RE = /\d{6}/
const CHINESE_RE = /[\u4e00-\u9fa5]{2,10}/
const NUMBER_RE = /-?[\d,]+(?:\.\d{1,4})?/
const PRICE_HEADER_RE = /成本|均价|现价|当前|最新|市价/
const QTY_HEADER_RE = /数量|股数|持仓量/
const MV_HEADER_RE = /市值|金额|持仓市值/
const NAME_HEADER_RE = /名称|证券|股票/
const CODE_HEADER_RE = /代码|证券代码/

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

  // 优先尝试 2行/股票 模式（国内券商 APP 通用布局）
  const twoRowHoldings = parseTwoRowHoldings(rows)
  if (twoRowHoldings.length > 0) return twoRowHoldings

  // 回退到单行解析
  return parseSingleRowHoldings(rows)
}

// ==================== 2行/股票 解析 ====================
// 财通证券等券商持仓页面布局：
//   Row A: [股票名称] [盈亏金额] [持仓数量] [成本价]
//   Row B: [市值]    [盈亏%]    [可用数量] [现价]
// 每只股票占连续两行，且列的 X 坐标完全对齐

function parseTwoRowHoldings(rows: Row[]): RecognizedHolding[] {
  // 1. 找到所有"名称行"——包含 2-4 个中文字（股票名）的行
  const nameRowIndices: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const text = rows[i].words.map(w => w.words).join('')
    const chineseMatches = text.match(/[\u4e00-\u9fa5]{2,4}/g)
    if (chineseMatches && chineseMatches.length >= 1) {
      // 排除表头行（包含"名称"、"持仓"等关键字）
      if (!PRICE_HEADER_RE.test(text) && !QTY_HEADER_RE.test(text) &&
          !MV_HEADER_RE.test(text) && !NAME_HEADER_RE.test(text) &&
          !CODE_HEADER_RE.test(text)) {
        // 进一步确认：该行同时包含中文名称 + 数值（价格或数量）
        const hasNumbers = /\d/.test(text)
        if (hasNumbers) {
          nameRowIndices.push(i)
        }
      }
    }
  }

  if (nameRowIndices.length === 0) return []

  // 2. 配对：每个名称行 + 紧跟的数据行
  const pairs: Array<{ rowA: Row; rowB: Row }> = []
  for (const idx of nameRowIndices) {
    const rowA = rows[idx]
    // 找下一行作为 rowB —— 必须紧随其后且 Y 距离合理
    if (idx + 1 < rows.length) {
      const rowB = rows[idx + 1]
      const yGap = rowB.top - rowA.bottom
      const avgHeight = (rowA.bottom - rowA.top + rowB.bottom - rowB.top) / 2
      if (yGap >= -avgHeight * 0.5 && yGap <= avgHeight * 1.5) {
        pairs.push({ rowA, rowB })
      }
    }
  }

  if (pairs.length === 0) return []

  // 3. 推断列的 X 位置（基于所有行的 word X 坐标聚类）
  const allWords = pairs.flatMap(p => [...p.rowA.words, ...p.rowB.words])
  const columnXs = inferTwoRowColumns(allWords)

  // 4. 逐对解析
  const holdings: RecognizedHolding[] = []
  for (const { rowA, rowB } of pairs) {
    const rowACells = assignWordsToColumns(rowA.words, columnXs)
    const rowBCells = assignWordsToColumns(rowB.words, columnXs)

    // 列0: 名称(RowA) / 市值(RowB)
    // 列1: 盈亏金额(RowA) / 盈亏%(RowB)
    // 列2: 持仓(RowA) / 可用(RowB)
    // 列3: 成本价(RowA) / 现价(RowB)
    const name = extractText(rowACells[0])
    const marketValue = parseNumber(extractText(rowBCells[0]).replace(/,/g, ''))
    const quantity = parseNumber(extractText(rowACells[2]).replace(/,/g, ''))
    const costPrice = parseNumber(extractText(rowACells[3]).replace(/,/g, ''))
    const currentPrice = parseNumber(extractText(rowBCells[3]).replace(/,/g, ''))

    // 兜底：如果列解析失败，从整行提取
    let finalName = name
    let finalQuantity = quantity
    let finalCost = costPrice
    let finalCurrent = currentPrice
    let finalMV = marketValue

    if (!finalName) {
      const rowAText = rowA.words.map(w => w.words).join(' ')
      const nameMatch = rowAText.match(/[\u4e00-\u9fa5]{2,4}/)
      if (nameMatch) finalName = nameMatch[0]
    }

    // 从 rowA 提取价格
    if (finalCost === 0) {
      const rowAText = rowA.words.map(w => w.words).join(' ')
      const nums = rowAText.match(/[\d,]+\.\d{1,4}/g) || []
      if (nums.length >= 2) {
        // 通常第2-3个价格是成本价
        finalCost = parseNumber(nums[nums.length - 2].replace(/,/g, '')) ||
                    parseNumber(nums[nums.length - 1].replace(/,/g, ''))
      } else if (nums.length === 1) {
        finalCost = parseNumber(nums[0].replace(/,/g, ''))
      }
    }

    // 从 rowB 提取现价
    if (finalCurrent === 0) {
      const rowBText = rowB.words.map(w => w.words).join(' ')
      const nums = rowBText.match(/[\d,]+\.\d{1,4}/g) || []
      if (nums.length >= 1) {
        finalCurrent = parseNumber(nums[nums.length - 1].replace(/,/g, ''))
      }
    }

    // 从 rowA 提取数量（整数）
    if (finalQuantity === 0) {
      const rowAText = rowA.words.map(w => w.words).join(' ')
      const ints = rowAText.match(/\d{2,10}/g) || []
      for (const intStr of ints) {
        const val = parseInt(intStr, 10)
        if (val >= 100 && val < 1000000) {
          finalQuantity = val
          break
        }
      }
    }

    // 从 rowB 提取市值
    if (finalMV === 0) {
      const rowBText = rowB.words.map(w => w.words).join(' ')
      const mvMatch = rowBText.match(/[\d,]+\.\d{2}/g)
      if (mvMatch) {
        const maxVal = Math.max(...mvMatch.map(s => parseNumber(s.replace(/,/g, ''))))
        if (maxVal > 1000) finalMV = maxVal
      }
    }

    // 至少需要名称
    if (!finalName) continue

    const holding: RecognizedHolding = {
      name: finalName,
      symbol: '',  // 财通证券等不显示代码，由用户手动补充
      quantity: Math.round(finalQuantity),
      costPrice: finalCost,
      currentPrice: finalCurrent || finalCost,
      marketValue: finalMV
    }

    if (!holding.currentPrice && holding.costPrice) {
      holding.currentPrice = holding.costPrice
    }
    if (!holding.marketValue && holding.quantity > 0 && holding.currentPrice > 0) {
      holding.marketValue = holding.quantity * holding.currentPrice
    }

    holdings.push(holding)
  }

  return deduplicateHoldings(holdings)
}

function inferTwoRowColumns(words: Word[]): number[] {
  // 将所有 word 的 X 中心坐标聚类成 4 列
  const centers = words.map(w => w.left + w.width / 2).sort((a, b) => a - b)
  if (centers.length === 0) return []

  // 找 4 个聚类中心
  const clusters: number[][] = []
  const gapThreshold = (centers[centers.length - 1] - centers[0]) / 8

  for (const c of centers) {
    const last = clusters[clusters.length - 1]
    if (!last || c - last[last.length - 1] > gapThreshold) {
      clusters.push([c])
    } else {
      last.push(c)
    }
  }

  // 如果聚不出 4 列，用等分法
  if (clusters.length < 3) {
    const minX = centers[0]
    const maxX = centers[centers.length - 1]
    const colWidth = (maxX - minX) / 4
    return [minX + colWidth / 2, minX + colWidth * 1.5, minX + colWidth * 2.5, minX + colWidth * 3.5]
  }

  return clusters.map(c => c.reduce((a, b) => a + b, 0) / c.length)
}

function assignWordsToColumns(words: Word[], columnXs: number[]): string[] {
  const cells: string[] = new Array(columnXs.length).fill('')
  for (const w of words) {
    const cx = w.left + w.width / 2
    let bestCol = 0
    let bestDist = Infinity
    for (let i = 0; i < columnXs.length; i++) {
      const dist = Math.abs(cx - columnXs[i])
      if (dist < bestDist) {
        bestDist = dist
        bestCol = i
      }
    }
    cells[bestCol] = cells[bestCol] ? cells[bestCol] + ' ' + w.words : w.words
  }
  return cells
}

function extractText(text: string): string {
  return (text || '').trim()
}

// ==================== 单行解析（回退） ====================

function parseSingleRowHoldings(rows: Row[]): RecognizedHolding[] {
  const headerRowIndex = findHeaderRow(rows)

  let columnDefs: ColumnDef[] = []
  if (headerRowIndex >= 0) {
    columnDefs = inferColumnsFromHeader(rows[headerRowIndex])
  }
  if (columnDefs.length === 0) {
    columnDefs = inferColumnsHeuristically(rows)
  }

  const holdings: RecognizedHolding[] = []
  for (let i = 0; i < rows.length; i++) {
    if (i === headerRowIndex) continue
    const row = rows[i]
    const h = parseRowWithColumns(row, columnDefs)
    if (h && (h.name || h.symbol)) {
      if (h.name && h.symbol) {
        holdings.push(h)
      } else if (h.symbol && (h.currentPrice > 0 || h.quantity > 0)) {
        holdings.push(h)
      } else if (h.name && (h.currentPrice > 0 || h.quantity > 0)) {
        holdings.push(h)
      }
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
      // 如果 word 的 top 落在行的 y 范围内（允许 1/2 行高的容差），归为同一行
      const tolerance = Math.max(8, (row.bottom - row.top) * 0.5)
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

function findHeaderRow(rows: Row[]): number {
  let bestIndex = -1
  let bestScore = 0
  for (let i = 0; i < rows.length; i++) {
    const text = rows[i].words.map(w => w.words).join(' ')
    let score = 0
    if (PRICE_HEADER_RE.test(text)) score += 1
    if (QTY_HEADER_RE.test(text)) score += 1
    if (MV_HEADER_RE.test(text)) score += 1
    if (NAME_HEADER_RE.test(text)) score += 1
    if (CODE_HEADER_RE.test(text)) score += 1
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  return bestScore >= 2 ? bestIndex : -1
}

type ColumnKind = 'name' | 'code' | 'quantity' | 'cost' | 'price' | 'marketValue' | 'unknown'

interface ColumnDef {
  kind: ColumnKind
  xCenter: number
  xMin: number
  xMax: number
}

function inferColumnsFromHeader(headerRow: Row): ColumnDef[] {
  const defs: ColumnDef[] = []
  for (const w of headerRow.words) {
    const kind = classifyHeaderWord(w.words)
    if (kind === 'unknown') continue
    defs.push({
      kind,
      xCenter: w.left + w.width / 2,
      xMin: w.left - w.width * 0.4,
      xMax: w.left + w.width * 1.4
    })
  }
  return defs.sort((a, b) => a.xCenter - b.xCenter)
}

function classifyHeaderWord(text: string): ColumnKind {
  if (PRICE_HEADER_RE.test(text)) {
    if (/成本|均价/.test(text)) return 'cost'
    if (/现价|当前|最新|市价/.test(text)) return 'price'
  }
  if (QTY_HEADER_RE.test(text)) return 'quantity'
  if (MV_HEADER_RE.test(text)) return 'marketValue'
  if (NAME_HEADER_RE.test(text)) return 'name'
  if (CODE_HEADER_RE.test(text)) return 'code'
  return 'unknown'
}

function inferColumnsHeuristically(rows: Row[]): ColumnDef[] {
  // 启发式：收集所有可能的代码/数字/中文名，按 x 聚类
  const allWords = rows.flatMap(r => r.words)
  const codePositions: number[] = []
  const pricePositions: number[] = []
  const qtyPositions: number[] = []

  for (const w of allWords) {
    const text = w.words.trim()
    if (STOCK_CODE_RE.test(text) || (CODE_LIKE_RE.test(text) && /^\d{6}$/.test(text))) {
      codePositions.push(w.left + w.width / 2)
    } else if (NUMBER_RE.test(text) && !STOCK_CODE_RE.test(text)) {
      const n = parseFloat(text.replace(/,/g, ''))
      if (!isNaN(n)) {
        if (n >= 1 && n < 10000) {
          pricePositions.push(w.left + w.width / 2)
        } else if (n >= 100 && n < 100000000) {
          qtyPositions.push(w.left + w.width / 2)
        }
      }
    }
  }

  const defs: ColumnDef[] = []
  if (codePositions.length > 0) {
    const x = median(codePositions)
    defs.push({ kind: 'code', xCenter: x, xMin: x - 60, xMax: x + 60 })
  }
  if (pricePositions.length > 0) {
    const sorted = [...pricePositions].sort((a, b) => a - b)
    // 通常有两个价格列（成本 / 现价）或一个市值列
    const clusters = clusterPositions(sorted, 80)
    for (const c of clusters.slice(0, 2)) {
      const cx = median(c)
      // 右侧更可能是现价或市值
      const kind: ColumnKind = defs.some(d => d.kind === 'cost') ? 'price' : 'cost'
      defs.push({ kind, xCenter: cx, xMin: cx - 50, xMax: cx + 50 })
    }
  }
  if (qtyPositions.length > 0) {
    const x = median(qtyPositions)
    defs.push({ kind: 'quantity', xCenter: x, xMin: x - 50, xMax: x + 50 })
  }

  // 名称列 = 代码列左边的区域
  const codeDef = defs.find(d => d.kind === 'code')
  if (codeDef) {
    defs.push({
      kind: 'name',
      xCenter: codeDef.xCenter - 80,
      xMin: 0,
      xMax: codeDef.xMin
    })
  }

  return defs.sort((a, b) => a.xCenter - b.xCenter)
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function clusterPositions(sorted: number[], gap: number): number[][] {
  const clusters: number[][] = []
  for (const p of sorted) {
    const last = clusters[clusters.length - 1]
    if (!last || p - last[last.length - 1] > gap) {
      clusters.push([p])
    } else {
      last.push(p)
    }
  }
  return clusters
}

function parseRowWithColumns(row: Row, columns: ColumnDef[]): RecognizedHolding | null {
  const cellMap: Record<ColumnKind, string> = {
    name: '',
    code: '',
    quantity: '',
    cost: '',
    price: '',
    marketValue: '',
    unknown: ''
  }

  // 每个 word 分配到最近的列
  for (const w of row.words) {
    const cx = w.left + w.width / 2
    let bestCol: ColumnDef | null = null
    let bestDist = Infinity
    for (const col of columns) {
      if (cx >= col.xMin && cx <= col.xMax) {
        const dist = Math.abs(cx - col.xCenter)
        if (dist < bestDist) {
          bestDist = dist
          bestCol = col
        }
      }
    }
    const kind = bestCol ? bestCol.kind : 'unknown'
    if (kind === 'unknown') continue
    cellMap[kind] = (cellMap[kind] ? cellMap[kind] + ' ' : '') + w.words
  }

  // 兜底：如果没识别到 code/name，从整行文本推断
  if (!cellMap.code && !cellMap.name) {
    const rowText = row.words.map(w => w.words).join(' ')
    const codeMatch = rowText.match(STOCK_CODE_RE)
    if (codeMatch) cellMap.code = codeMatch[0]
    const nameMatch = rowText.match(CHINESE_RE)
    if (nameMatch) cellMap.name = nameMatch[0]
  }

  const symbol = normalizeSymbol(cellMap.code.trim())
  const name = cellMap.name.trim()

  // 进一步兜底：如果列解析没有识别到价格/数量，从整行文本提取
  if (cellMap.price === '' && cellMap.cost === '' && cellMap.quantity === '') {
    const rowText = row.words.map(w => w.words).join(' ')
    const nums: string[] = rowText.match(/[\d,]+\.\d{1,4}/g) || []
    const ints: string[] = rowText.match(/\d{1,10}/g) || []

    if (!cellMap.price && nums.length > 0) {
      cellMap.price = nums[0] || ''
    }
    if (!cellMap.quantity && ints.length > 0) {
      const intStr = ints[0] || ''
      const intVal = parseInt(intStr.replace(/,/g, ''), 10)
      if (intVal > 100) {
        cellMap.quantity = intStr
      }
    }
  }

  const quantity = parseNumber(cellMap.quantity)
  const costPrice = parseNumber(cellMap.cost)
  const currentPrice = parseNumber(cellMap.price)
  const marketValue = parseNumber(cellMap.marketValue)

  // 不再强制要求必须有 name 和 symbol，允许只有 symbol + price 等部分信息
  if (!symbol && !name) return null

  const holding: RecognizedHolding = {
    name,
    symbol,
    quantity: Math.round(quantity),
    costPrice,
    currentPrice,
    marketValue
  }

  if (!holding.currentPrice && holding.costPrice) {
    holding.currentPrice = holding.costPrice
  }
  if (!holding.marketValue && holding.quantity > 0 && holding.currentPrice > 0) {
    holding.marketValue = holding.quantity * holding.currentPrice
  }

  return holding
}

function parseNumber(s: string): number {
  if (!s) return 0
  const match = s.match(NUMBER_RE)
  if (!match) return 0
  const n = parseFloat(match[0].replace(/,/g, ''))
  return isNaN(n) ? 0 : n
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

  // 1) 找到所有"名称行"：包含 2-4 个中文字（股票名）且有数字的行
  const nameRowIdxs: number[] = []
  const headerRegex = /(持仓|名称|代码|市值|成本|现价|盈亏|数量|可用|首页|交易|资讯|自选|买入|卖出|撤单|查询|管理|批量|止盈|止损)/
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const nameMatch = line.match(/[\u4e00-\u9fa5]{2,4}/)
    if (!nameMatch) continue
    if (headerRegex.test(line)) continue
    if (!/\d/.test(line)) continue
    nameRowIdxs.push(i)
  }

  // 2) 每对 {名称行, 紧接的数据行} 合并处理
  for (const idx of nameRowIdxs) {
    const rowA = rawLines[idx]
    const rowB = (idx + 1 < rawLines.length) ? rawLines[idx + 1] : ''
    const combined = rowA + ' ' + rowB

    // 提取名称：2-4 个中文字
    const nameMatch = rowA.match(/[\u4e00-\u9fa5]{2,4}/)
    if (!nameMatch) continue
    const name = nameMatch[0]

    // 收集所有价格数字（带小数的）和整数
    const allNums = combined.match(/[\d,]+\.\d{1,4}/g) || []   // 价格、市值、百分比
    const allInts = combined.match(/\b\d{2,10}\b/g) || []      // 持仓数量（整数）
    const nums = allNums.map(s => parseFloat(s.replace(/,/g, ''))).filter(n => !isNaN(n))
    const ints = allInts.map(s => parseInt(s.replace(/,/g, ''), 10)).filter(n => !isNaN(n))

    // 过滤掉百分比（即 < 100 的负数）
    const positiveNums = nums.filter(n => n > 0)

    // 数量：最大的整数且 >= 100
    let quantity = 0
    const goodInts = ints.filter(n => n >= 100 && n < 10000000)
    if (goodInts.length > 0) quantity = Math.max(...goodInts)

    // 现价：最小的价格（通常在 rowB 末尾）
    // 成本价：倒数第二小的价格（通常在 rowA 末尾）
    // 市值：最大的价格（通常在 rowB 开头）
    const sortedByDesc = [...positiveNums].sort((a, b) => b - a)
    const sortedByAsc = [...positiveNums].sort((a, b) => a - b)

    let marketValue = 0
    let costPrice = 0
    let currentPrice = 0

    // 市值：最大的数，如果它 > 1000（元）
    if (sortedByDesc[0] >= 1000) marketValue = sortedByDesc[0]

    // 现价和成本：较小的两个数
    const smallPrices = sortedByAsc.filter(n => n < 100000 && n > 0.5)
    if (smallPrices.length >= 2) {
      // 一般现价 < 成本价（亏损），但也可能反过来
      costPrice = smallPrices[smallPrices.length - 2]  // 倒数第二小（成本价）
      currentPrice = smallPrices[smallPrices.length - 1]  // 最小（现价）
    } else if (smallPrices.length === 1) {
      currentPrice = smallPrices[0]
      costPrice = smallPrices[0]
    }

    // 如果没找到数量但有市值和现价，反推
    if (quantity === 0 && marketValue > 0 && currentPrice > 0) {
      quantity = Math.round(marketValue / currentPrice)
    }
    // 如果数量找到了但没市值，反推
    if (marketValue === 0 && quantity > 0 && currentPrice > 0) {
      marketValue = quantity * currentPrice
    }
    if (!costPrice && currentPrice) costPrice = currentPrice
    if (!currentPrice && costPrice) currentPrice = costPrice

    if (name && quantity > 0 && (costPrice > 0 || currentPrice > 0)) {
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
