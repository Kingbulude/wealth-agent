import { createWorker, PSM, OEM, type Worker } from 'tesseract.js'
import { enhanceForTextRecognition } from './imageProcessor'
import { getApiUrl } from '../utils/apiUrl'
import { useAuthStore } from '../renderer/stores/authStore'

export interface RecognizedHolding {
  name: string
  symbol: string
  quantity: number        // 持仓数量
  available?: number       // 可用数量
  costPrice: number
  currentPrice: number
  marketValue: number
  profit?: number          // 浮动盈亏金额（带正负）
  profitRate?: number      // 浮动盈亏比例（百分比，e.g. -16.27 表示 -16.27%）
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
// 对财通证券、东方财富、同花顺等主流券商布局统一采用：
//   1) 按 word 的 left（x 坐标）聚类成 4 大列（列容差根据屏幕宽度自适应）
//      COL_NAME    —— 名称（上）+ 市值（下）
//      COL_PROFIT  —— 盈亏金额（上）+ 盈亏%（下，带±和%号）
//      COL_QTY     —— 持仓数（上）+ 可用数（下，两只数字相同）
//      COL_PRICE   —— 成本价（上）+ 现价（下）
//   2) 名称列里识别纯中文词（股票名），取其 y 范围作为「锚点行」
//   3) 在其余 3 列找与锚点行 y 重合的词 → 对应到上一行字段；
//      再用锚点行下方（0.6~1.4 倍行高）的词 → 对应到下一行字段

interface Word extends BaiduWord {
  left: number
  top: number
  width: number
  height: number
  centerX: number
  centerY: number
}

interface Row {
  top: number
  bottom: number
  words: Word[]
}

const QTY_HEADER_RE = /数量|股数|持仓量/
const MV_HEADER_RE = /市值|金额|持仓市值/

const COL_HEADERS = {
  NAME:    /^名称$|^证券$|^股票$|^持仓股$|^基金名称$/,
  PROFIT:  /^盈亏$|^收益$|^浮盈浮亏$|^浮动盈亏$/,
  QTY:     /^持仓$|^持仓\/可用$|^数量$|^股数$|^持仓量$/,
  PRICE:   /^成本$|^现价$|^成本\/现价$|^均价$|^当前价$|^最新价$|^市价$/,
  MV:      /^市值$|^金额$|^持仓市值$|^总市值$/,
  RATE:    /^涨跌幅$|^盈亏比例$/,
  AVAIL:   /^可用$|^可卖$/,
}

function parseHoldingsByLocation(words: BaiduWord[]): RecognizedHolding[] {
  if (words.length === 0) return []

  const ws: Word[] = words
    .filter(w => !!w.location && w.words && w.words.length > 0)
    .map(w => ({
      words: w.words,
      left: w.location!.left,
      top: w.location!.top,
      width: w.location!.width,
      height: w.location!.height,
      centerX: w.location!.left + w.location!.width / 2,
      centerY: w.location!.top + w.location!.height / 2,
    }))
  if (ws.length < 6) return []

  // 先定位表头区：识别 header 关键字的词，得到每个列的 x 锚点
  const headerAnchors = new Map<string, number>()
  for (const w of ws) {
    for (const [key, re] of Object.entries(COL_HEADERS)) {
      if (re.test(w.words.trim())) {
        headerAnchors.set(key, w.centerX)
        break
      }
    }
  }

  // 根据屏幕宽度计算 4 分线（fallback，没有表头时启用）
  const maxRight = Math.max(...ws.map(w => w.left + w.width))
  const colFallback = [maxRight * 0.20, maxRight * 0.45, maxRight * 0.68, maxRight * 0.88]

  // 列定位优先级：header 关键字 → 退而求其次用 4 分线
  // 每只股票占 4 列：列1 = 名称+市值 列2 = 盈亏+盈亏% 列3 = 持仓+可用 列4 = 成本+现价
  const col1x = headerAnchors.get('NAME') ?? colFallback[0] * 0.6 // 名称列通常靠左
  const col2x = headerAnchors.get('PROFIT') ?? colFallback[1]
  const col3x = headerAnchors.get('QTY') ?? colFallback[2]
  const col4x = headerAnchors.get('PRICE') ?? colFallback[3]

  function assignCol(x: number): 1 | 2 | 3 | 4 {
    const d1 = Math.abs(x - col1x), d2 = Math.abs(x - col2x), d3 = Math.abs(x - col3x), d4 = Math.abs(x - col4x)
    const m = Math.min(d1, d2, d3, d4)
    if (m === d1) return 1
    if (m === d2) return 2
    if (m === d3) return 3
    return 4
  }

  // 用 header 行作为切分边界：表头以上（总资产、可用等）不参与股票解析；持仓股表头以下才是真实数据
  const headerY = (() => {
    const ys: number[] = []
    for (const w of ws) {
      if (COL_HEADERS.NAME.test(w.words.trim()) || COL_HEADERS.MV.test(w.words.trim()) ||
          /持仓股/.test(w.words) || /查看已清仓/.test(w.words)) {
        ys.push(w.top + w.height)
      }
    }
    if (ys.length === 0) return Math.min(...ws.map(w => w.top))
    return Math.max(...ys)
  })()
  const footerY = (() => {
    const ys: number[] = []
    for (const w of ws) {
      if (/查看已清仓|持仓资讯|资产分析|首页$|行情$|自选$|交易$|资讯$/.test(w.words)) {
        ys.push(w.top)
      }
    }
    if (ys.length === 0) return Math.max(...ws.map(w => w.top + w.height))
    return Math.min(...ys)
  })()

  const inStockRegion = (w: Word) => w.centerY > headerY && w.centerY < footerY

  // 1) 挑出所有「股票名候选词」：列1、纯中文（2~6字）、非 header 关键字、在数据区内
  const chinese2to6 = /^[\u4e00-\u9fa5]{2,6}$/
  const headerStopWords = new Set([
    '持仓股','市值','盈亏','持仓','可用','成本','现价','总资产','浮动盈亏','当日参考盈亏',
    '总市值','可用','可取','逆回购','转账','查看已清仓股票','人民','人民币账户','主账户',
    '财通证券','查看已清仓','持仓资讯','资产分析','批量买入','批量卖出','止盈止损','持仓管理'
  ])
  const anchors: Word[] = ws
    .filter(w => {
      if (!inStockRegion(w)) return false
      if (assignCol(w.centerX) !== 1) return false
      const t = w.words.trim()
      if (!chinese2to6.test(t)) return false
      if (headerStopWords.has(t)) return false
      return true
    })
    .sort((a, b) => a.top - b.top)

  if (anchors.length === 0) {
    // 找不到纯中文列1的股票名（非典型布局或列定位失败）→ 回退到 parseRowsByName
    const rows = clusterIntoRows(ws)
    return parseRowsByName(rows)
  }

  // 2) 对每个锚点股票名，在 4 列找上下两行配对的词
  // 行高 = 锚点行高度作为基准
  const avgAnchorHeight = anchors.reduce((s, a) => s + a.height, 0) / anchors.length
  const rowH = Math.max(avgAnchorHeight, 16)

  const holdings: RecognizedHolding[] = []
  for (const nameWord of anchors) {
    const name = nameWord.words.trim()

    // 在每列里找与名称行 y 相近的词
    // 上一行窗口：[nameWord.top - rowH*0.4, nameWord.bottom + rowH*0.4]
    const topY = nameWord.top
    const bottomY = nameWord.top + nameWord.height
    const windowTop = topY - rowH * 0.5
    const windowBottom = bottomY + rowH * 0.5

    // 下一行窗口（名称行正下方，0.6~1.6 行高）：
    const nextWinTop = bottomY + rowH * 0.3
    const nextWinBottom = bottomY + rowH * 1.8

    function wordsInCol(col: 1|2|3|4, yTop: number, yBot: number): Word[] {
      return ws
        .filter(w => inStockRegion(w))
        .filter(w => assignCol(w.centerX) === col)
        .filter(w => {
          const cy = w.centerY
          return cy >= yTop && cy <= yBot
        })
        .sort((a, b) => a.centerY - b.centerY)
    }

    // 列2：盈亏金额（上）+ 盈亏%（下）
    const col2Top = wordsInCol(2, windowTop, windowBottom)
    const col2Bot = wordsInCol(2, nextWinTop, nextWinBottom)
    let profit = 0
    let profitRate: number | undefined = undefined
    for (const w of col2Top) {
      const n = parseSignedNumber(w.words)
      if (n !== null && (Math.abs(n) >= 1 || /[%％]/.test(w.words) === false)) {
        if (!profit || Math.abs(n) > Math.abs(profit)) profit = n
      }
    }
    for (const w of [...col2Top, ...col2Bot]) {
      const pct = parsePercent(w.words)
      if (pct !== null) { profitRate = pct; break }
    }

    // 列3：持仓数量（上）+ 可用（下）
    const col3Top = wordsInCol(3, windowTop, windowBottom)
    const col3Bot = wordsInCol(3, nextWinTop, nextWinBottom)
    let quantity = 0
    let available: number | undefined = undefined
    for (const w of col3Top) {
      const n = parsePureInt(w.words)
      if (n !== null && n >= 1) { quantity = n; break }
    }
    for (const w of col3Bot) {
      const n = parsePureInt(w.words)
      if (n !== null && n >= 1) { available = n; break }
    }
    // 如果上下两个整数完全一致，通常是持仓=可用（财通证券等的惯例），可用就不必重复写
    // 但还是保存 available 让 UI 可选显示

    // 列4：成本价（上）+ 现价（下）
    const col4Top = wordsInCol(4, windowTop, windowBottom)
    const col4Bot = wordsInCol(4, nextWinTop, nextWinBottom)
    let costPrice = 0
    let currentPrice = 0
    for (const w of col4Top) {
      const n = parsePositiveNumber(w.words)
      if (n !== null && n > 0) { costPrice = n; break }
    }
    for (const w of col4Bot) {
      const n = parsePositiveNumber(w.words)
      if (n !== null && n > 0) { currentPrice = n; break }
    }
    // 有些布局只给 2 个 price 数字但都在同一行；如果只解析到 1 个，另一个从 col4 剩余数字补
    if ((costPrice === 0 || currentPrice === 0) && col4Top.length + col4Bot.length >= 2) {
      const allPrices: number[] = []
      for (const w of [...col4Top, ...col4Bot]) {
        const n = parsePositiveNumber(w.words)
        if (n !== null && n > 0) allPrices.push(n)
      }
      if (allPrices.length >= 2 && costPrice === 0) costPrice = allPrices[0]
      if (allPrices.length >= 2 && currentPrice === 0) currentPrice = allPrices[allPrices.length - 1]
    }

    // 列1：市值（名称行正下方）
    const col1Bot = wordsInCol(1, nextWinTop, nextWinBottom)
    let marketValue = 0
    for (const w of col1Bot) {
      const n = parsePositiveNumber(w.words)
      if (n !== null && n >= 100) { marketValue = n; break }
    }

    // 反推兜底：市值反推数量、现价等
    if (marketValue === 0 && quantity > 0 && currentPrice > 0) {
      marketValue = round2(quantity * currentPrice)
    }
    if (quantity === 0 && marketValue > 0 && currentPrice > 0) {
      quantity = Math.round(marketValue / currentPrice)
    }
    if (!costPrice && currentPrice) costPrice = currentPrice
    if (!currentPrice && costPrice) currentPrice = costPrice
    if (available === undefined && quantity > 0) available = quantity

    if (name && (quantity > 0 || costPrice > 0 || currentPrice > 0 || marketValue > 0)) {
      // 盈亏比例兜底：基于成本×数量-市值 反推
      if (profitRate === undefined && quantity > 0 && costPrice > 0 && marketValue > 0) {
        const cost = quantity * costPrice
        if (cost > 0) profitRate = round2((marketValue - cost) / cost * 100)
      }
      if (profit === 0 && quantity > 0 && costPrice > 0 && currentPrice > 0) {
        profit = round2((currentPrice - costPrice) * quantity)
      }

      holdings.push({
        name,
        symbol: '',
        quantity,
        available,
        costPrice,
        currentPrice,
        marketValue,
        profit: profit || undefined,
        profitRate: profitRate !== undefined ? profitRate : undefined,
      })
    }
  }

  const deduped = deduplicateHoldings(holdings)
  if (deduped.length > 0) return deduped

  // 如果 4 列分箱算法完全没结果，再回退行级解析（兼容东方财富单行布局等）
  const rows = clusterIntoRows(ws)
  return parseRowsByName(rows)
}

// ==================== 行级名称检测（兜底） ====================
// 当列定位失效或布局是「1行一只股票」时使用。
// 关键修复：不再要求名称行里包含数字 —— 否则像财通证券那种"名称"单独成一个纯中文 word，永远被过滤掉。

function parseRowsByName(rows: Row[]): RecognizedHolding[] {
  const headerRegex = /(持仓股|总资产|总市值|浮动盈亏|当日参考盈亏|可用|可取|逆回购|转账|查看已清仓|成本\/现价|持仓\/可用|人民|财通证券|首页|行情|自选|交易|资讯|资产分析|持仓资讯|批量买入|批量卖出|止盈止损|持仓管理|持仓|名称|证券|股票|代码|证券代码|盈亏|涨跌幅|收益|冻结|市值|金额|持仓市值|数量|股数|持仓量|成本|均价|现价|当前|最新|市价)$/

  const isNameRow = (row: Row): boolean => {
    const text = row.words.map(w => w.words).join('')
    // 名称行：必须含有 2~6 个连续中文词（股票名），且不是表头
    const chineseMatches = text.match(/[\u4e00-\u9fa5]{2,6}/g)
    if (!chineseMatches || chineseMatches.length === 0) return false
    // 排除整行全是表头词
    if (chineseMatches.every(m => headerRegex.test(m))) return false
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
    const collectedRows: Row[] = [rowA]
    if (idx + 1 < rows.length && !isNameRow(rows[idx + 1])) {
      collectedRows.push(rows[idx + 1])
    }

    // 股票名：选 col1（left 最小的中文词）
    let name = ''
    const chineseWordCandidates = rowA.words
      .filter(w => /[\u4e00-\u9fa5]{2,6}/.test(w.words))
      .filter(w => !headerRegex.test(w.words))
      .sort((a, b) => a.left - b.left)
    if (chineseWordCandidates.length > 0) {
      const m = chineseWordCandidates[0].words.match(/[\u4e00-\u9fa5]{2,6}/)
      if (m) name = m[0]
    }
    if (!name) continue

    const combinedText = collectedRows.map(r => r.words.map(w => w.words).join(' ')).join(' ')
    // —— 提取全部数字（带正负号、百分号、逗号）——
    // 1) 百分比：单独提取盈亏比例（带正负 + %）
    let profitRate: number | undefined = undefined
    const pctM = combinedText.match(/([+-]?\s*\d[\d,]*\.?\d+)\s*[%％]/)
    if (pctM) {
      const pct = parsePercent(pctM[0])
      if (pct !== null) profitRate = pct
    }
    // 2) 带正负号的数字：第一笔通常是盈亏金额
    let profit = 0
    const signedAll = combinedText.match(/[+-]\s*\d[\d,]*(?:\.\d+)?|\(\s*\d[\d,]*(?:\.\d+)?\s*\)/g) || []
    for (const tok of signedAll) {
      if (/[%％]/.test(tok)) continue
      const n = parseSignedNumber(tok)
      if (n !== null) {
        if (!profit) profit = n
        // 盈亏金额通常绝对值最大（不是百分之几的小数）
        if (Math.abs(n) > Math.abs(profit)) profit = n
      }
    }
    // 3) 纯数字（不含符号，含小数）
    const nums = (combinedText.match(/[\d,]+(?:\.\d+)?/g) || [])
      .map(s => parseFloat(s.replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0)
    const ints = nums.filter(n => Number.isInteger(n))

    // 数量：最大的整数；可用：次大整数（如果和数量相同则省略）
    let quantity = 0
    let available: number | undefined = undefined
    const intsSorted = [...ints].sort((a, b) => b - a)
    if (intsSorted.length >= 1) quantity = Math.round(intsSorted[0])
    if (intsSorted.length >= 2 && intsSorted[1] !== intsSorted[0]) available = Math.round(intsSorted[1])

    // 市值：最大的小数或 >= 100 的小数/整数
    let marketValue = 0
    const bigNums = nums.filter(n => n >= 500).sort((a, b) => b - a)
    if (bigNums.length >= 1) marketValue = bigNums[0]

    // 成本价和现价：最小的两个 0.5~10000 的小数（且 2 位数价格优先）
    let costPrice = 0
    let currentPrice = 0
    const priceCandidates = nums.filter(n => n > 0.5 && n < 10000).sort((a, b) => a - b)
    if (priceCandidates.length >= 2) {
      costPrice = priceCandidates[priceCandidates.length - 2]
      currentPrice = priceCandidates[priceCandidates.length - 1]
    } else if (priceCandidates.length === 1) {
      costPrice = priceCandidates[0]
      currentPrice = priceCandidates[0]
    }

    // 反推兜底
    if (marketValue === 0 && quantity > 0 && currentPrice > 0) marketValue = round2(quantity * currentPrice)
    if (quantity === 0 && marketValue > 0 && currentPrice > 0) quantity = Math.round(marketValue / currentPrice)
    if (!costPrice && currentPrice) costPrice = currentPrice
    if (!currentPrice && costPrice) currentPrice = costPrice
    if (available === undefined && quantity > 0) available = quantity
    if (profitRate === undefined && quantity > 0 && costPrice > 0 && marketValue > 0) {
      const cost = quantity * costPrice
      if (cost > 0) profitRate = round2((marketValue - cost) / cost * 100)
    }
    if (profit === 0 && quantity > 0 && costPrice > 0 && currentPrice > 0 && Math.abs(currentPrice - costPrice) > 1e-6) {
      profit = round2((currentPrice - costPrice) * quantity)
    }

    if (name && (quantity > 0 || costPrice > 0 || currentPrice > 0 || marketValue > 0)) {
      holdings.push({
        name,
        symbol: '',
        quantity,
        available,
        costPrice,
        currentPrice,
        marketValue,
        profit: profit || undefined,
        profitRate: profitRate !== undefined ? profitRate : undefined,
      })
    }
  }

  return deduplicateHoldings(holdings)
}

// ==================== 数字解析辅助 ====================
function round2(n: number): number {
  if (!isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/** 解析带正负号的数字（支持 "+40,168.83"、"-1,789.52"、"-16.27%"、"(1,234)" 会计负数） */
function parseSignedNumber(s: string): number | null {
  if (!s) return null
  let t = s.trim().replace(/[,，]/g, '')
  if (!t) return null
  // 括号会计格式：(100) → -100
  const paren = t.match(/^\(\s*([+-]?\d+(?:\.\d+)?)\s*\)$/)
  if (paren) t = '-' + paren[1]
  // 去掉 %
  t = t.replace(/[%％]/g, '')
  const m = t.match(/^([+-]?)\s*(\d+(?:\.\d+)?)$/)
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const num = parseFloat(m[2])
  if (isNaN(num)) return null
  return sign * num
}

/** 解析百分数："-16.270%" → -16.27、"+7.9%" → 7.9 */
function parsePercent(s: string): number | null {
  if (!s) return null
  if (!/[%％]/.test(s)) return null
  const n = parseSignedNumber(s)
  if (n === null) return null
  return round2(n)
}

/** 正小数或正整数（不接受负号）*/
function parsePositiveNumber(s: string): number | null {
  if (!s) return null
  const t = s.trim().replace(/[,，]/g, '').replace(/[%％]/g, '')
  const m = t.match(/^\d+(?:\.\d+)?$/)
  if (!m) return null
  const n = parseFloat(t)
  if (isNaN(n) || n <= 0) return null
  return n
}

/** 纯整数（如 6100 / 5500 / 200）*/
function parsePureInt(s: string): number | null {
  if (!s) return null
  const t = s.trim().replace(/[,，]/g, '')
  if (!/^\d+$/.test(t)) return null
  const n = parseInt(t, 10)
  if (isNaN(n) || n < 0) return null
  return n
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
