import { Asset } from '../types/asset'
import { Holding } from '../types/holding'

export interface WealthSummary {
  totalNetWorth: number          // 净资产
  totalAssets: number             // 总资产
  totalLiabilities: number        // 总负债
  assetDistribution: {
    type: string
    amount: number
    percentage: number
    color: string
  }[]
  liquidityScore: number          // 流动性评分（0-100）
  lastUpdated: string
}

export interface GrowthProjection {
  year: number
  amount: number
}

// 货币转换率
const CURRENCY_RATES: Record<string, number> = {
  CNY: 1,
  USD: 7.2,
  EUR: 7.8,
  HKD: 0.92,
  JPY: 0.048
}

// 流动性评分权重（1=最低流动性，5=最高流动性）
const LIQUIDITY_WEIGHTS: Record<string, number> = {
  cash: 5,
  'cash & equivalents': 5,
  stock: 4,
  fund: 3,
  investment: 3.5,
  real_estate: 1,
  'real estate': 1,
  precious_metal: 2,
  'precious metals & collectibles': 2,
  debt: 0,
  other: 2.5
}

export class WealthCalculator {
  /**
   * 货币换算：将任意币种金额转换为人民币（CNY）
   * 静态方法，供资产管理、资产总览、图表等模块复用
   */
  static convertToCNY(amount: number, currency: string = 'CNY'): number {
    if (!Number.isFinite(amount)) return 0
    const rate = CURRENCY_RATES[currency] ?? 1
    return amount * rate
  }

  /**
   * 计算完整的财富汇总
   */
  static calculateSummary(assets: Asset[]): WealthSummary {
    // 1. 转换为统一货币（CNY）
    const normalizedAssets = assets.map(asset => ({
      ...asset,
      amountInCNY: asset.amount * (CURRENCY_RATES[asset.currency] || 1)
    }))

    // 2. 计算总资产和总负债
    const totalAssets = normalizedAssets
      .filter(a => a.category !== 'debt')
      .reduce((sum, a) => sum + a.amountInCNY, 0)

    const totalLiabilities = normalizedAssets
      .filter(a => a.category === 'debt')
      .reduce((sum, a) => sum + a.amountInCNY, 0)

    // 3. 计算净资产
    const totalNetWorth = totalAssets - totalLiabilities

    // 4. 资产分布统计
    const assetDistribution = this.calculateDistribution(normalizedAssets, totalAssets)

    // 5. 流动性评分
    const liquidityScore = this.calculateLiquidityScore(normalizedAssets, totalAssets)

    return {
      totalNetWorth,
      totalAssets,
      totalLiabilities,
      assetDistribution,
      liquidityScore,
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * 将持仓市值合并到资产列表中
   * 规则：
   * 1. 资产表中 category='investment' 且 type 为 stock/fund 并带 symbol 的资产，
   *    若持仓表存在同代码同类型的持仓，则用持仓市值替换其金额，并标记为联动。
   * 2. 持仓表中存在但资产表中没有对应 symbol 的，自动追加一条联动资产，
   *    确保净资产能完整反映持仓市值。
   * 3. 资产表中没有 symbol 的投资资产保持原值，作为非上市投资处理。
   */
  static mergeHoldingsIntoAssets(assets: Asset[], holdings: Holding[]): Asset[] {
    // 复制一份，避免修改原数组
    const merged: Asset[] = assets.map(a => ({ ...a }))

    // 第一步：替换已存在的同名投资资产为持仓市值
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i]
      if (a.category === 'investment' && (a.type === 'stock' || a.type === 'fund') && a.symbol) {
        const holding = holdings.find(h => h.symbol === a.symbol && h.type === a.type)
        if (holding && (holding.currentPrice || holding.avgCost) > 0) {
          merged[i] = {
            ...a,
            amount: (holding.currentPrice || holding.avgCost) * holding.quantity,
            name: `${holding.name}（联动）`,
            isLinked: true,
            updatedAt: holding.lastUpdated || new Date().toISOString()
          }
        }
      }
    }

    // 第二步：为资产表中不存在的持仓追加联动资产
    for (const h of holdings) {
      if (!h.symbol) continue
      const exists = merged.find(a =>
        a.category === 'investment' && a.type === h.type && a.symbol === h.symbol
      )
      if (!exists) {
        const marketValue = (h.currentPrice || h.avgCost) * h.quantity
        merged.push({
          id: `linked-${h.id}`,
          userId: h.userId || '',
          category: 'investment',
          type: h.type,
          name: `${h.name}（联动）`,
          symbol: h.symbol,
          amount: marketValue,
          currency: h.currency || 'CNY',
          description: '🔗 联动持仓',
          isLinked: true,
          createdAt: h.lastUpdated || new Date().toISOString(),
          updatedAt: h.lastUpdated || new Date().toISOString()
        })
      }
    }

    return merged
  }

  /**
   * 基于资产和持仓共同计算财富汇总
   * 这是资产总览页、Web/App/桌面三端统一使用的入口，
   * 保证净资产、总资产在不同端、不同组件中计算一致。
   */
  static calculateSummaryWithHoldings(assets: Asset[], holdings: Holding[]): WealthSummary {
    const mergedAssets = this.mergeHoldingsIntoAssets(assets, holdings)
    return this.calculateSummary(mergedAssets)
  }

  /**
   * 计算资产分布
   */
  private static calculateDistribution(
    assets: Array<Asset & { amountInCNY: number }>,
    totalAssets: number
  ) {
    const ASSET_COLORS: Record<string, string> = {
      cash: '#52c41a',
      stock: '#1890ff',
      fund: '#722ed1',
      real_estate: '#fa8c16',
      debt: '#f5222d'
    }

    const distribution: Record<string, number> = {}

    assets.forEach(asset => {
      if (asset.category !== 'debt') {
        distribution[asset.category] = (distribution[asset.category] || 0) + asset.amountInCNY
      }
    })

    return Object.entries(distribution).map(([type, amount]) => ({
      type,
      amount,
      percentage: totalAssets > 0 ? (amount / totalAssets) * 100 : 0,
      color: ASSET_COLORS[type] || '#999'
    }))
  }

  /**
   * 计算流动性评分
   * 公式：加权平均流动性分数（0-100）
   */
  private static calculateLiquidityScore(
    assets: Array<Asset & { amountInCNY: number }>,
    totalAssets: number
  ): number {
    if (totalAssets === 0) return 0

    let weightedScore = 0

    assets
      .filter(a => a.category !== 'debt')
      .forEach(asset => {
        const weight = asset.amountInCNY / totalAssets
        const liquidityWeight = LIQUIDITY_WEIGHTS[asset.category] || 0
        // 将1-5的权重转换为0-100分
        weightedScore += weight * (liquidityWeight / 5) * 100
      })

    return Math.round(weightedScore * 10) / 10
  }

  /**
   * 财富增长预测
   */
  static calculateGrowthProjection(
    currentNetWorth: number,
    assets: Asset[],
    years: number = 5
  ): GrowthProjection[] {
    // 计算加权平均增长率
    const ASSET_GROWTH_RATES: Record<string, number> = {
      cash: 2,       // 银行存款年利率约2%
      stock: 8,       // 股票历史年化约8%
      fund: 6,       // 基金年化约6%
      real_estate: 5, // 房产年增长约5%
      debt: 0        // 负债不计算增长
    }

    const assetsOnly = assets.filter(a => a.category !== 'debt')
    if (assetsOnly.length === 0) {
      // 没有资产，返回当前值
      return Array.from({ length: years }, (_, i) => ({
        year: i + 1,
        amount: currentNetWorth
      }))
    }

    // 计算加权平均增长率
    const totalValue = assetsOnly.reduce((sum, a) => {
      const cnyAmount = a.amount * (CURRENCY_RATES[a.currency] || 1)
      return sum + cnyAmount
    }, 0)

    let weightedGrowth = 0
    assetsOnly.forEach(asset => {
      const cnyAmount = asset.amount * (CURRENCY_RATES[asset.currency] || 1)
      const weight = cnyAmount / totalValue
      const growthRate = ASSET_GROWTH_RATES[asset.category] || 0
      weightedGrowth += weight * growthRate
    })

    // 生成预测数据
    const projections: GrowthProjection[] = []
    let projectedValue = currentNetWorth

    for (let year = 1; year <= years; year++) {
      projectedValue = projectedValue * (1 + weightedGrowth / 100)
      projections.push({
        year,
        amount: Math.round(projectedValue * 100) / 100
      })
    }

    return projections
  }
}