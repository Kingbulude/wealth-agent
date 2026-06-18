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

function getSinaStockCode(code: string): string {
  if (code.startsWith('6')) return `sh${code}`
  if (code.startsWith('0') || code.startsWith('3')) return `sz${code}`
  if (code.startsWith('8')) return `bj${code}`
  return `sh${code}`
}

export async function fetchStockPrice(code: string): Promise<StockData | null> {
  try {
    const sinaCode = getSinaStockCode(code)
    const url = `https://hq.sinajs.cn/list=${sinaCode}`
    
    const response = await fetch(url)
    const text = await response.text()
    
    const match = text.match(/var hq_str_[\w]+="([^"]+)"/)
    if (match) {
      const data = match[1].split(',')
      if (data.length >= 4) {
        const price = parseFloat(data[3]) || 0
        const prevClose = parseFloat(data[2]) || 0
        const open = parseFloat(data[1]) || 0
        
        if (price > 0) {
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
  } catch (error) {
    console.error('获取股票价格失败:', code, error)
    return null
  }
}

export async function fetchFundNav(code: string): Promise<FundData | null> {
  try {
    const url = `https://hq.sinajs.cn/list=fu_${code}`
    
    const response = await fetch(url)
    const text = await response.text()
    
    const match = text.match(/var hq_str_fu_[\w]+="([^"]+)"/)
    if (match) {
      const data = match[1].split(',')
      if (data.length >= 4) {
        const nav = parseFloat(data[1]) || 0
        const prevNav = parseFloat(data[2]) || 0
        
        if (nav > 0) {
          return {
            code,
            name: data[0],
            nav,
            prevNav,
            change: nav - prevNav,
            changePercent: prevNav > 0 ? ((nav - prevNav) / prevNav) * 100 : 0,
            updateTime: data[data.length - 1] || ''
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('获取基金净值失败:', code, error)
    return null
  }
}

export async function fetchBatchPrices(holdings: Array<{ type: 'stock' | 'fund'; symbol: string }>): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>()
  
  const promises = holdings.map(async (h) => {
    if (h.type === 'stock') {
      const data = await fetchStockPrice(h.symbol)
      if (data && data.price > 0) {
        priceMap.set(h.symbol, data.price)
      }
    } else {
      const data = await fetchFundNav(h.symbol)
      if (data && data.nav > 0) {
        priceMap.set(h.symbol, data.nav)
      }
    }
  })
  
  await Promise.all(promises)
  return priceMap
}
