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

export async function fetchStockPrice(code: string): Promise<StockData | null> {
  try {
    const exchange = getExchangeCode(code)
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${exchange}.${code}&fields=f57,f58,f116,f117,f43,f44,f92,f175`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.data) {
      return {
        code: data.data.f57,
        name: data.data.f58,
        price: parseFloat(data.data.f43) || 0,
        prevClose: parseFloat(data.data.f116) || 0,
        open: parseFloat(data.data.f117) || 0,
        change: parseFloat(data.data.f44) || 0,
        changePercent: parseFloat(data.data.f92) || 0,
        updateTime: data.data.f175 || ''
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
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`
    
    const response = await fetch(url)
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
