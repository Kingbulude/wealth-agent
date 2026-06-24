export const CHART_COLORS = {
  brand: '#c9a76a',
  brandLight: '#d8be88',
  brandDark: '#b08d4f',

  cash: '#4a9b7e',
  investment: '#3a6fc7',
  realEstate: '#c98a3a',
  precious: '#8a5cc9',
  currency: '#2c9bb8',
  debt: '#d63b3b',

  up: '#d63b3b',
  down: '#1e9b6c',
  flat: '#8a8f9f',

  current: '#3a6fc7',
  recommended: '#c9a76a',

  textPrimary: '#1a1d2e',
  textSecondary: '#5a6072',
  textTertiary: '#8a8f9f',

  gridLine: '#eef0f4',
  cardBorder: '#eef0f4',
  tooltipBg: '#ffffff',
  tooltipBorder: '#eef0f4'
}

export const ASSET_CATEGORY_COLORS: Record<string, string> = {
  cash: '#4a9b7e',
  investment: '#3a6fc7',
  real_estate: '#c98a3a',
  precious: '#8a5cc9',
  currency: '#2c9bb8',
  debt: '#d63b3b'
}

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  cash: '现金储蓄',
  investment: '投资资产',
  real_estate: '房产土地',
  precious: '贵金属收藏',
  currency: '外汇数字币',
  debt: '负债'
}

export const CHART_FONT = {
  fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontSize: 12,
  fontWeight: 500
}

export const CHART_ANIMATION = {
  duration: 800,
  easing: 'ease-out'
}

export const RECOMMENDED_ALLOCATION = {
  investment: 40,
  cash: 20,
  real_estate: 0,
  precious: 0,
  currency: 0,
  other: 10,
  fixedIncome: 30
}

export function formatMoney(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`
  }
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export function formatMoneyFull(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
