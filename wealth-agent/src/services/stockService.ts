export interface StockData {
  code: string
  name: string
  price: number
  prevClose: number
  open: number
  change: number
  changePercent: number
  updateTime: string
}

export interface FundData {
  code: string
  name: string
  nav: number
  prevNav: number
  change: number
  changePercent: number
  updateTime: string
}

function getExchangeCode(code: string): string {
  if (code.startsWith('6')) return '1'
  if (code.startsWith('0') || code.startsWith('3')) return '0'
  if (code.startsWith('8')) return '8'
  return '1'
}

function getYahooCode(code: string): string {
  if (code.startsWith('6')) return `${code}.SS`
  if (code.startsWith('0') || code.startsWith('3')) return `${code}.SZ`
  return `${code}.SS`
}

async function fetchWithTimeout(url: string, timeout: number = 5000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchStockFromEastMoney(code: string): Promise<StockData | null> {
  try {
    const exchange = getExchangeCode(code)
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${exchange}.${code}&fields=f57,f58,f116,f117,f43,f44,f92,f175`
    
    const response = await fetchWithTimeout(url)
    const data = await response.json()
    
    if (data.data) {
      const price = parseFloat(data.data.f43) || 0
      if (isValidPrice(price)) {
        return {
          code: data.data.f57,
          name: data.data.f58,
          price,
          prevClose: parseFloat(data.data.f116) || 0,
          open: parseFloat(data.data.f117) || 0,
          change: parseFloat(data.data.f44) || 0,
          changePercent: parseFloat(data.data.f92) || 0,
          updateTime: data.data.f175 || ''
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchStockFromSina(code: string): Promise<StockData | null> {
  try {
    const exchange = code.startsWith('6') ? 'sh' : code.startsWith('0') || code.startsWith('3') ? 'sz' : 'sh'
    const url = `https://hq.sinajs.cn/list=${exchange}${code}`
    
    const response = await fetchWithTimeout(url)
    const text = await response.text()
    
    const match = text.match(/var hq_str_[\w]+="([^"]+)"/)
    if (match) {
      const data = match[1].split(',')
      if (data.length >= 4) {
        const price = parseFloat(data[3]) || 0
        const prevClose = parseFloat(data[2]) || 0
        const open = parseFloat(data[1]) || 0
        
        if (price > 0 && isValidPrice(price)) {
          return {
            code,
            name: data[0],
            price,
            prevClose,
            open,
            change: price - prevClose,
            changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
            updateTime: data[data.length - 1] || ''
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchStockFromYahoo(code: string): Promise<StockData | null> {
  try {
    const yahooCode = getYahooCode(code)
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooCode}`
    
    const response = await fetchWithTimeout(url)
    const data = await response.json()
    
    if (data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result.length > 0) {
      const item = data.quoteResponse.result[0]
      const price = item.regularMarketPrice || 0
      const prevClose = item.regularMarketPreviousClose || 0
      
      if (price > 0 && isValidPrice(price)) {
        return {
          code,
          name: item.shortName || item.longName || code,
          price,
          prevClose,
          open: item.regularMarketOpen || 0,
          change: item.regularMarketChange || (price - prevClose),
          changePercent: item.regularMarketChangePercent || (prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0),
          updateTime: item.regularMarketTime ? new Date(item.regularMarketTime * 1000).toLocaleString() : ''
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchStockFromTencent(code: string): Promise<StockData | null> {
  try {
    const exchange = code.startsWith('6') ? 'sh' : code.startsWith('0') || code.startsWith('3') ? 'sz' : 'sh'
    const url = `https://qt.gtimg.cn/q=${exchange}${code}`
    
    const response = await fetchWithTimeout(url)
    const text = await response.text()
    
    const match = text.match(/v_[\w]+="([^"]+)"/)
    if (match) {
      const data = match[1].split('~')
      if (data.length >= 4) {
        const price = parseFloat(data[3]) || 0
        const prevClose = parseFloat(data[4]) || 0
        const open = parseFloat(data[5]) || 0
        
        if (price > 0 && isValidPrice(price)) {
          return {
            code,
            name: data[1],
            price,
            prevClose,
            open,
            change: parseFloat(data[31]) || (price - prevClose),
            changePercent: parseFloat(data[32]) || (prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0),
            updateTime: data[data.length - 1] || ''
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

function isValidPrice(price: number): boolean {
  return price > 0 && price <= 10000
}

export async function fetchStockPrice(code: string): Promise<StockData | null> {
  const sources = [
    { name: 'tencent', fn: () => fetchStockFromTencent(code) },
    { name: 'eastmoney', fn: () => fetchStockFromEastMoney(code) },
    { name: 'sina', fn: () => fetchStockFromSina(code) },
    { name: 'yahoo', fn: () => fetchStockFromYahoo(code) }
  ]
  
  for (const { name, fn } of sources) {
    try {
      console.debug(`尝试从 ${name} 获取股票 ${code} 价格...`)
      const result = await fn()
      if (result && result.price > 0) {
        if (isValidPrice(result.price)) {
          console.debug(`${name} 成功获取 ${code} 价格: ¥${result.price}`)
          return result
        } else {
          console.warn(`${name} 返回异常价格 ¥${result.price}，已跳过`)
        }
      } else {
        console.debug(`${name} 返回无效数据:`, result)
      }
    } catch (error: any) {
      console.warn(`${name} API调用失败:`, error.message || error)
    }
  }
  
  console.warn(`所有API源均无法获取股票 ${code} 的有效价格`)
  return null
}

export async function fetchFundNav(code: string): Promise<FundData | null> {
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`
    
    const response = await fetchWithTimeout(url)
    const text = await response.text()
    
    const match = text.match(/var\s+pgz\s*=\s*({[\s\S]*});/)
    if (match) {
      const data = JSON.parse(match[1])
      return {
        code: data.fundCode,
        name: data.fundName,
        nav: parseFloat(data.dwjz) || 0,
        prevNav: parseFloat(data.yestdwjz) || 0,
        change: (parseFloat(data.dwjz) || 0) - (parseFloat(data.yestdwjz) || 0),
        changePercent: parseFloat(data.gszzl) || 0,
        updateTime: data.jzrq || ''
      }
    }
    return null
  } catch {
    return null
  }
}

export async function fetchBatchPrices(holdings: Array<{ type: 'stock' | 'fund'; symbol: string }>): Promise<{ prices: Map<string, number>; successCount: number; totalCount: number }> {
  const priceMap = new Map<string, number>()
  let successCount = 0
  
  for (const h of holdings) {
    try {
      if (h.type === 'stock') {
        const data = await fetchStockPrice(h.symbol)
        if (data && data.price > 0) {
          priceMap.set(h.symbol, data.price)
          successCount++
        }
      } else {
        const data = await fetchFundNav(h.symbol)
        if (data && data.nav > 0) {
          priceMap.set(h.symbol, data.nav)
          successCount++
        }
      }
    } catch (error) {
      console.error(`获取${h.symbol}价格失败:`, error)
    }
  }
  
  return { prices: priceMap, successCount, totalCount: holdings.length }
}
