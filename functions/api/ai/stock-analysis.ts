// POST /api/ai/stock-analysis
// 智能股票分析：自动搜索股票 + 获取全面数据 + AI深度分析
// Body: { query: "用户的问题", context?: "用户财务概况" }

import { getAuthUser, jsonResponse, optionsResponse, requireAuth } from '../../lib/auth'

interface Env {
  AI: Ai
  JWT_SECRET?: string
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

const MODEL_LIST = [
  '@cf/zai-org/glm-4.7-flash',
  '@cf/qwen/qwen2.5-14b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/google/gemma-3-12b-it'
]

const SYSTEM_PROMPT = `你是一位专业的股票分析师（15年经验CFA持证人），擅长个股深度分析、行业研究和投资决策。

## 核心原则
1. 所有事实性陈述必须完全基于提供的【已核实真实数据】，禁止编造任何数据
2. 数据不足的维度必须明确标注"数据不足"，绝对不能猜测或编造
3. 分析路径：大盘环境 → 行业判断 → 个股分析 → 操作建议
4. 明确提示风险，不承诺收益，不保证买卖盈亏
5. 所有分析仅为研究参考，不构成投资建议，投资有风险，入市需谨慎

## 回答风格
- 专业、严谨、数据驱动
- 结构清晰，按模块输出
- 逻辑可追溯，结论有依据`

const ANALYSIS_FRAMEWORK = `
## 股票分析输出格式（八模块）

请严格按照以下八个模块输出分析：

### 模块1：一句话结论
四类结论之一 + 是否可入场 + 置信度
四类结论：**重点关注（可建仓）** / **跟踪观察（等待买点）** / **谨慎观望（逻辑一般）** / **暂不推荐（逻辑不成立）**
示例："XX股票：跟踪观察，当前位置不建议建仓，置信度中等。"

### 模块2：行业景气度与资金流向
| 项目 | 内容 |
|------|------|
| 所属行业 | [从数据中获取，没有则写"数据不足"] |
| 行业热度 | [高/中/低，不确定写"数据不足"] |
| 行业阶段 | [启动/主升/高位震荡/退潮，不确定写"数据不足"] |
| 资金流向 | [持续流入/存量博弈/持续流出，不确定写"数据不足"] |
| 综合判定 | 是否当前参与的好时机 |

### 模块3：个股定位
一句话赛道地位 + 一句话盈利确定性 + 一句话当前筹码/估值位置
（每项数据不足时明确标注）

### 模块4：未来2-3个月催化事件
| 时间 | 事件 | 方向 | 强度 |
|------|------|------|------|
（无明确催化时写"暂无明确催化事件，需持续跟踪"）

### 模块5：短期弹性与资金博弈评估
| 评估项 | 内容 |
|--------|------|
| 情绪温度 | [X]分，处于[过热/偏热/中性/偏冷/冰冷]区间 |
| 主导资金 | [机构/游资/散户主导]，处于[建仓/拉升/派发]期 |
| 弹性评分 | [X]分（A级/B级/C级/D级） |
| 短期盈亏比 | [X]:1，胜率约X% |
| 关键价位 | 压力位[X元]，支撑位[X元] |
（缺少数据的项写"数据不足"，可基于当前价格做逻辑推演但标注"推演"）

### 模块6：情景推演与概率
| 情景 | 概率 | 触发条件 | 目标价区间 | 时间窗口 |
|------|------|----------|------------|----------|
| 乐观 | X% | [具体描述] | [X-Y元] | X个月 |
| 中性 | X% | [具体描述] | [X-Y元] | X个月 |
| 悲观 | X% | [具体描述] | [X-Y元] | X个月 |

### 模块7：同行业对比与替代推荐
（如有同行业数据则列出；没有则写"数据不足，建议关注行业龙头标的"）

替代推荐：在[行业]赛道中，[XX股票]风险收益比最优（数据不足时写"无法给出替代推荐"）

### 模块8：操作建议
| 操作项 | 内容 |
|--------|------|
| 当前阶段 | [阶段判定] |
| 建议仓位区间 | [X]%–[Y]% |
| 建仓策略 | 分批买入策略 |
| 止损线 | [具体价位或百分比] |
| 止盈策略 | 分批止盈策略 |
（数据不足时给出保守建议，如"建议观望，待数据明朗后再决策"）

---
**风险提示**：以上分析仅为研究参考，不构成投资建议，投资有风险，入市需谨慎。`

// ==================== 工具函数 ====================

async function fetchWithTimeout(url: string, ms = 5000, referer = 'https://quote.eastmoney.com/'): Promise<Response> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    return await fetch(url, {
      signal: c.signal,
      headers: { 'User-Agent': UA, 'Referer': referer }
    })
  } finally {
    clearTimeout(t)
  }
}

function getExchangeCode(code: string): string {
  if (/^\d{5}$/.test(code)) return '116'
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return '1'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return '0'
  if (code.startsWith('4') || code.startsWith('8')) return '8'
  return '1'
}

function getMarket(code: string): 'sh' | 'sz' | 'bj' | 'hk' {
  if (/^\d{5}$/.test(code)) return 'hk'
  if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) return 'sh'
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1') || code.startsWith('2')) return 'sz'
  return 'bj'
}

function isValidPrice(price: number, prevClose: number): boolean {
  if (!isFinite(price) || price <= 0) return false
  if (price < 0.01 || price > 10000) return false
  if (isFinite(prevClose) && prevClose > 0) {
    const deviation = Math.abs(price - prevClose) / prevClose
    if (deviation > 0.3) return false
  }
  return true
}

// ==================== 股票搜索 ====================

async function searchStock(keyword: string): Promise<Array<{code: string, name: string, market: string}>> {
  try {
    const r = await fetchWithTimeout(
      `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=5&token=D43BF722C8E33BDC906FB84D85E326E8`,
      4000,
      'https://www.eastmoney.com/'
    )
    const j: any = await r.json()
    if (j?.QuotationCodeTable?.Data && Array.isArray(j.QuotationCodeTable.Data)) {
      return j.QuotationCodeTable.Data.map((it: any) => ({
        code: it.Code,
        name: it.Name,
        market: it.MktNum === '1' ? 'SH' : it.MktNum === '0' ? 'SZ' : 'BJ'
      }))
    }
  } catch (e) {
    console.warn('[search] failed:', (e as Error).message)
  }
  return []
}

// ==================== 公司基本信息（东方财富F10） ====================

async function fetchCompanyInfo(code: string): Promise<any | null> {
  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_F10_ORG_BASICINFO&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)`
    const r = await fetchWithTimeout(url, 5000, 'https://data.eastmoney.com/')
    const j: any = await r.json()
    if (j?.success && j?.result?.data?.length > 0) {
      const d = j.result.data[0]
      return {
        name: d.SECURITY_NAME_ABBR || '',
        fullName: d.ORG_NAME || '',
        industry: d.EM2016 || '',
        industry1: d.BOARD_NAME_1LEVEL || '',
        industry2: d.BOARD_NAME_2LEVEL || '',
        industry3: d.BOARD_NAME_3LEVEL || '',
        concepts: d.BLGAINIAN || '',
        region: d.REGIONBK || '',
        listingDate: d.LISTING_DATE ? d.LISTING_DATE.split(' ')[0] : '',
        profile: d.ORG_PROFILE || '',
        mainBusiness: d.MAIN_BUSINESS || '',
        grossMargin: d.GROSS_PROFIT_RATIO || 0,
        incomeStructure: d.INCOME_STRU_NAMENEW || '',
        incomeRatio: d.INCOME_STRU_RATIONEW || '',
        chairman: d.CHAIRMAN || '',
        employees: d.TOTAL_NUM || 0,
        website: d.ORG_WEB || '',
        registeredCapital: d.REG_CAPITAL || 0
      }
    }
  } catch (e) {
    console.warn('[company] failed:', (e as Error).message)
  }
  return null
}

// ==================== 财务摘要（东方财富） ====================

async function fetchFinancialSummary(code: string): Promise<any | null> {
  try {
    // 利润表
    const incomeUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageSize=2&sortColumns=REPORT_DATE&sortTypes=-1`
    const incomeR = await fetchWithTimeout(incomeUrl, 5000, 'https://data.eastmoney.com/')
    const incomeJ: any = await incomeR.json()
    
    // 资产负债表
    const balanceUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_BALANCE&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageSize=2&sortColumns=REPORT_DATE&sortTypes=-1`
    const balanceR = await fetchWithTimeout(balanceUrl, 5000, 'https://data.eastmoney.com/')
    const balanceJ: any = await balanceR.json()
    
    const result: any = {}
    
    if (incomeJ?.success && incomeJ?.result?.data?.length > 0) {
      const inc = incomeJ.result.data[0]
      const prev = incomeJ.result.data[1] || null
      result.reportDate = inc.REPORT_DATE ? inc.REPORT_DATE.split(' ')[0] : ''
      result.revenue = inc.TOTAL_OPERATE_INCOME || 0
      result.revenueGrowth = inc.TOI_RATIO || 0
      result.netProfit = inc.PARENT_NETPROFIT || 0
      result.netProfitGrowth = inc.PARENT_NETPROFIT_RATIO || 0
      result.deductNetProfit = inc.DEDUCT_PARENT_NETPROFIT || 0
      result.deductGrowth = inc.DPN_RATIO || 0
      result.operateProfit = inc.OPERATE_PROFIT || 0
      result.grossProfitMargin = 0
      if (inc.TOTAL_OPERATE_INCOME && inc.OPERATE_COST) {
        result.grossProfitMargin = ((inc.TOTAL_OPERATE_INCOME - inc.OPERATE_COST) / inc.TOTAL_OPERATE_INCOME) * 100
      }
      result.saleExpense = inc.SALE_EXPENSE || 0
      result.manageExpense = inc.MANAGE_EXPENSE || 0
      result.financeExpense = inc.FINANCE_EXPENSE || 0
    }
    
    if (balanceJ?.success && balanceJ?.result?.data?.length > 0) {
      const bal = balanceJ.result.data[0]
      result.totalAssets = bal.TOTAL_ASSETS || 0
      result.totalLiabilities = bal.TOTAL_LIABILITIES || 0
      result.totalEquity = bal.TOTAL_EQUITY || 0
      result.debtAssetRatio = bal.DEBT_ASSET_RATIO || 0
      result.currentRatio = bal.CURRENT_RATIO || 0
      result.cash = bal.MONETARYFUNDS || 0
      result.receivables = bal.ACCOUNTS_RECE || 0
      result.inventory = bal.INVENTORY || 0
      result.accountsPayable = bal.ACCOUNTS_PAYABLE || 0
    }
    
    if (result.reportDate || result.revenue) {
      return result
    }
  } catch (e) {
    console.warn('[financial] failed:', (e as Error).message)
  }
  return null
}

// ==================== 股票行情（腾讯，字段最丰富） ====================

async function fetchStockQuote(code: string): Promise<any | null> {
  try {
    const ex = getMarket(code)
    const url = `https://qt.gtimg.cn/q=${ex}${code}`
    const r = await fetchWithTimeout(url, 5000, 'https://gu.qq.com/')
    const buf = await r.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buf)
    const m = text.match(/v_[\w]+="([^"]+)"/)
    if (!m) return null
    const d = m[1].split('~')
    if (d.length < 35) return null

    const price = parseFloat(d[3]) || 0
    const prevClose = parseFloat(d[4]) || 0
    if (!isValidPrice(price, prevClose)) return null

    const result: any = {
      code,
      name: d[1] || '',
      price,
      prevClose,
      open: parseFloat(d[5]) || 0,
      change: parseFloat(d[31]) || (price - prevClose),
      changePercent: parseFloat(d[32]) || 0,
      high: parseFloat(d[33]) || 0,
      low: parseFloat(d[34]) || 0,
      source: 'tencent'
    }

    // 扩展字段
    if (d.length >= 46) {
      result.volume = parseFloat(d[6]) || 0         // 成交量（手）
      result.turnover = parseFloat(d[37]) || 0       // 成交额（万元）
      result.turnoverRate = parseFloat(d[38]) || 0   // 换手率
      result.pe = parseFloat(d[39]) || 0             // 市盈率
      result.pb = parseFloat(d[46]) || 0             // 市净率
      result.totalMarketCap = parseFloat(d[45]) || 0 // 总市值（亿）
      result.circulatingMarketCap = parseFloat(d[44]) || 0 // 流通市值（亿）
    }

    return result
  } catch (e) {
    console.warn('[quote] tencent failed:', (e as Error).message)
  }
  return null
}

// ==================== 大盘指数 ====================

async function fetchIndexQuotes(): Promise<Array<{name: string, price: number, changePercent: number}>> {
  const indices = [
    { code: 'sh000001', name: '上证指数' },
    { code: 'sz399001', name: '深证成指' },
    { code: 'sz399006', name: '创业板指' }
  ]
  
  const results: Array<{name: string, price: number, changePercent: number}> = []
  
  for (const idx of indices) {
    try {
      const url = `https://hq.sinajs.cn/list=${idx.code}`
      const r = await fetchWithTimeout(url, 4000, 'https://finance.sina.com.cn/')
      const buf = await r.arrayBuffer()
      const text = new TextDecoder('gbk').decode(buf)
      const m = text.match(/var hq_str_[\w]+="([^"]+)"/)
      if (m) {
        const d = m[1].split(',')
        if (d.length >= 4) {
          const price = parseFloat(d[3]) || 0
          const prevClose = parseFloat(d[2]) || 0
          const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0
          if (price > 0) {
            results.push({ name: idx.name, price, changePercent })
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
  
  return results
}

// ==================== 股票关键词提取 ====================

function extractStockKeyword(query: string): string | null {
  // 1. 匹配6位数字代码
  const codeMatch = query.match(/\b[0-9]{6}\b/)
  if (codeMatch) return codeMatch[0]
  
  // 2. 匹配带前缀的代码
  const prefixedMatch = query.match(/(sh|sz|bj)[0-9]{6}/i)
  if (prefixedMatch) return prefixedMatch[0].replace(/^(sh|sz|bj)/i, '')
  
  // 3. 清理分析类词汇后提取中文词组
  const cleaned = query
    .replace(/分析|诊断|评估|研究|一下|看看|说说|怎么样|如何|推荐|买入|卖出|股票|个股|标的|这只|那只|这个|那个|持仓|仓位|行情|走势|帮忙|给我|帮我/gi, '')
    .replace(/[，。？！,.!?\s]+/g, ' ')
    .trim()
  
  if (cleaned.length >= 2 && cleaned.length <= 8 && /[\u4e00-\u9fa5]/.test(cleaned)) {
    return cleaned
  }
  
  // 4. 提取第一个2-4字的中文词组（排除停用词）
  const stopWords = new Set(['分析','诊断','评估','研究','一下','看看','说说','股票','个股','标的','持仓','仓位','行情','走势','怎么样','如何','推荐','买入','卖出','可以','今天','明天','最近','现在','目前','什么','这个','那个','帮忙','给我','帮我','一下','请问','麻烦'])
  const cnWords = query.match(/[\u4e00-\u9fa5]{2,4}/g)
  if (cnWords) {
    const candidates = cnWords.filter(w => !stopWords.has(w))
    if (candidates.length > 0) return candidates[0]
  }
  
  return null
}

// ==================== AI 调用 ====================

async function runModel(AI: any, model: string, messages: Array<{role: string, content: string}>): Promise<string> {
  const response = await AI.run(model, { messages })
  const reply = response?.response || (typeof response === 'string' ? response : '')
  if (typeof reply === 'string' && reply.trim().length > 0) return reply
  if (response?.choices?.[0]?.message?.content) return response.choices[0].message.content
  throw new Error(`Empty response from model ${model}`)
}

// ==================== 主函数 ====================

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await getAuthUser(context.request, context.env)
  if (!user) return requireAuth()

  try {
    const body = await context.request.json() as { query?: string, context?: string }
    if (!body.query || !body.query.trim()) {
      return jsonResponse({ ok: false, error: 'query required' }, 400)
    }

    const query = body.query.trim()
    const userContext = body.context || ''
    
    // 1. 提取股票关键词
    const keyword = extractStockKeyword(query)
    
    let stockInfo: any = null
    let searchResults: any[] = []
    
    if (keyword) {
      // 2. 搜索股票
      searchResults = await searchStock(keyword)
      
      if (searchResults.length > 0) {
        // 3. 并行获取：行情 + 公司信息 + 财务数据
        const target = searchResults[0]
        const [quote, companyInfo, financialData] = await Promise.all([
          fetchStockQuote(target.code),
          fetchCompanyInfo(target.code),
          fetchFinancialSummary(target.code)
        ])
        if (quote) {
          stockInfo = { ...target, ...quote }
        }
        if (companyInfo) {
          stockInfo = { ...stockInfo, company: companyInfo }
        }
        if (financialData) {
          stockInfo = { ...stockInfo, financial: financialData }
        }
      }
    }
    
    // 4. 获取大盘指数
    const indices = await fetchIndexQuotes()
    
    // 5. 构建数据上下文
    let dataContext = ''
    
    if (stockInfo) {
      const s = stockInfo
      const sign = s.changePercent >= 0 ? '+' : ''
      dataContext += `### ✅ 已核实股票身份（唯一正确信息）\n`
      dataContext += `| 项目 | 数值 |\n|------|------|\n`
      dataContext += `| **股票名称** | **${s.name}** |\n`
      dataContext += `| **股票代码** | **${s.code}** |\n`
      dataContext += `| 交易所 | ${s.market || (s.code.startsWith('6') ? '上交所SH' : '深交所SZ')} |\n`
      dataContext += `| 最新价 | ¥${s.price.toFixed(2)} |\n`
      dataContext += `| 涨跌幅 | ${sign}${s.changePercent.toFixed(2)}% |\n`
      dataContext += `| 涨跌额 | ${sign}${s.change.toFixed(2)}元 |\n`
      dataContext += `| 今开 | ¥${s.open.toFixed(2)} |\n`
      dataContext += `| 昨收 | ¥${s.prevClose.toFixed(2)} |\n`
      if (s.high > 0) dataContext += `| 最高 | ¥${s.high.toFixed(2)} |\n`
      if (s.low > 0) dataContext += `| 最低 | ¥${s.low.toFixed(2)} |\n`
      if (s.volume > 0) dataContext += `| 成交量 | ${(s.volume / 10000).toFixed(2)}万手 |\n`
      if (s.turnover > 0) dataContext += `| 成交额 | ${(s.turnover / 10000).toFixed(2)}亿元 |\n`
      if (s.turnoverRate > 0) dataContext += `| 换手率 | ${s.turnoverRate.toFixed(2)}% |\n`
      if (s.pe > 0) dataContext += `| 市盈率(PE) | ${s.pe.toFixed(2)} |\n`
      if (s.pb > 0) dataContext += `| 市净率(PB) | ${s.pb.toFixed(2)} |\n`
      if (s.totalMarketCap > 0) dataContext += `| 总市值 | ${s.totalMarketCap.toFixed(2)}亿 |\n`
      if (s.circulatingMarketCap > 0) dataContext += `| 流通市值 | ${s.circulatingMarketCap.toFixed(2)}亿 |\n`
      dataContext += `| 数据来源 | 腾讯财经 |\n\n`
      dataContext += `> ⚠️ 重要：必须使用「${s.name}（${s.code}）」作为分析标的，禁止使用其他名称或代码。\n\n`
      
      // 公司基本信息
      if (s.company) {
        const c = s.company
        dataContext += `### 🏢 公司基本信息（来源：东方财富F10）\n`
        dataContext += `| 项目 | 内容 |\n|------|------|\n`
        if (c.fullName) dataContext += `| 公司全称 | ${c.fullName} |\n`
        if (c.industry2) dataContext += `| 申万二级行业 | ${c.industry2} |\n`
        if (c.industry3) dataContext += `| 申万三级行业 | ${c.industry3} |\n`
        if (c.region) dataContext += `| 所在地区 | ${c.region} |\n`
        if (c.listingDate) dataContext += `| 上市日期 | ${c.listingDate} |\n`
        if (c.chairman) dataContext += `| 董事长 | ${c.chairman} |\n`
        if (c.employees) dataContext += `| 员工人数 | ${c.employees}人 |\n`
        if (c.mainBusiness) dataContext += `| 主营业务 | ${c.mainBusiness} |\n`
        if (c.incomeStructure) dataContext += `| 收入构成 | ${c.incomeStructure} (${c.incomeRatio || ''}) |\n`
        if (c.grossMargin) dataContext += `| 毛利率 | ${c.grossMargin.toFixed(2)}% |\n`
        if (c.concepts) dataContext += `| 概念板块 | ${c.concepts} |\n`
        dataContext += `\n`
        
        if (c.profile) {
          // 截取前300字的公司简介
          const shortProfile = c.profile.length > 400 ? c.profile.slice(0, 400) + '...' : c.profile
          dataContext += `**公司简介**：${shortProfile}\n\n`
        }
      }
      
      // 财务数据
      if (s.financial && s.financial.reportDate) {
        const f = s.financial
        const revSign = f.revenueGrowth >= 0 ? '+' : ''
        const profitSign = f.netProfitGrowth >= 0 ? '+' : ''
        dataContext += `### 💰 财务摘要（报告期：${f.reportDate}）\n`
        dataContext += `| 项目 | 数值 |\n|------|------|\n`
        if (f.revenue > 0) dataContext += `| 营业收入 | ${(f.revenue / 100000000).toFixed(2)}亿 |\n`
        if (f.revenueGrowth !== 0) dataContext += `| 营收同比 | ${revSign}${f.revenueGrowth.toFixed(2)}% |\n`
        if (f.netProfit) dataContext += `| 归母净利润 | ${(f.netProfit / 100000000).toFixed(2)}亿 |\n`
        if (f.netProfitGrowth !== 0) dataContext += `| 净利同比 | ${profitSign}${f.netProfitGrowth.toFixed(2)}% |\n`
        if (f.deductNetProfit) dataContext += `| 扣非净利润 | ${(f.deductNetProfit / 100000000).toFixed(2)}亿 |\n`
        if (f.grossProfitMargin) dataContext += `| 毛利率 | ${f.grossProfitMargin.toFixed(2)}% |\n`
        if (f.totalAssets > 0) dataContext += `| 总资产 | ${(f.totalAssets / 100000000).toFixed(2)}亿 |\n`
        if (f.debtAssetRatio) dataContext += `| 资产负债率 | ${f.debtAssetRatio.toFixed(2)}% |\n`
        if (f.currentRatio) dataContext += `| 流动比率 | ${f.currentRatio.toFixed(2)}% |\n`
        if (f.cash > 0) dataContext += `| 货币资金 | ${(f.cash / 100000000).toFixed(2)}亿 |\n`
        dataContext += `\n`
      }
    } else if (keyword) {
      dataContext += `### ⚠️ 未找到匹配的股票\n`
      dataContext += `用户关键词：「${keyword}」\n`
      dataContext += `> 请在分析开头明确说明："未找到与「${keyword}」匹配的A股上市公司，请确认股票名称或代码。"\n\n`
    }
    
    // 大盘指数
    if (indices.length > 0) {
      dataContext += `### 📊 大盘指数（实时行情）\n`
      dataContext += `| 指数 | 最新点位 | 涨跌幅 |\n|------|----------|--------|\n`
      for (const idx of indices) {
        const sign = idx.changePercent >= 0 ? '+' : ''
        dataContext += `| ${idx.name} | ${idx.price.toFixed(2)} | ${sign}${idx.changePercent.toFixed(2)}% |\n`
      }
      dataContext += `\n`
    }
    
    // 6. 构建完整的消息
    const systemPrompt = SYSTEM_PROMPT + ANALYSIS_FRAMEWORK
    const userPrompt = `${userContext ? `## 用户财务概况\n${userContext}\n\n` : ''}## 用户问题\n${query}\n\n═══════════════════════════════════════════\n【已核实的真实数据 — 分析必须完全基于以下事实】\n═══════════════════════════════════════════\n\n${dataContext || '暂无股票数据，请先告知用户需要提供股票名称或代码。'}\n\n═══════════════════════════════════════════\n【数据结束】\n═══════════════════════════════════════════\n\n请基于以上数据进行专业分析，缺少数据的维度明确标注"数据不足"，严格按照八模块格式输出。`
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
    
    // 7. 调用 AI
    const errors: string[] = []
    for (const model of MODEL_LIST) {
      try {
        const reply = await runModel(context.env.AI, model, messages)
        return jsonResponse({
          ok: true,
          data: {
            reply,
            model,
            stock: stockInfo ? {
              code: stockInfo.code,
              name: stockInfo.name,
              price: stockInfo.price,
              changePercent: stockInfo.changePercent
            } : null,
            indices
          }
        })
      } catch (e: any) {
        const msg = e?.message || String(e)
        console.warn(`[ai] model ${model} failed: ${msg}`)
        errors.push(`${model}: ${msg}`)
      }
    }
    
    return jsonResponse({
      ok: false,
      error: `所有 AI 模型均失败：${errors.join('; ')}`
    }, 502)
    
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e.message || 'Stock analysis failed' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
