export interface Holding {
  id: string
  userId: string
  type: 'stock' | 'fund'
  symbol: string        // 股票/基金代码，如 "600519" / "005827" / "00700"(港股)
  name: string          // 名称
  quantity: number      // 持仓数量
  avgCost: number       // 平均成本（元）
  currentPrice: number  // 当前价格（元）
  currentChangePercent?: number  // 当日涨跌幅（%）
  currentChange?: number         // 当日涨跌额
  lastUpdated: string   // 最后更新时间
}

export interface HoldingFormData {
  type: 'stock' | 'fund'
  symbol: string
  name: string
  quantity: number
  avgCost: number
}

// 股票元数据（简化版，MVP先硬编码一些常用股票）
export const STOCK_META: Record<string, string> = {
  '600519': '贵州茅台',
  '000001': '平安银行',
  '601318': '中国平安',
  '000858': '五粮液',
  '600036': '招商银行',
  '601888': '中国中免',
  '002475': '立讯精密',
  '300750': '宁德时代',
  '600276': '恒瑞医药',
  '000333': '美的集团'
}

export const FUND_META: Record<string, string> = {
  '110022': '易方达消费行业',
  '000961': '天弘沪深300ETF',
  '161725': '招商中证白酒',
  '159915': '创业板ETF',
  '512000': '华宝券商ETF'
}
