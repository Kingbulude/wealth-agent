export const ASSET_CATEGORY_COLORS: Record<string, string> = {
  cash: '#3d9a7a',
  investment: '#4a7bc4',
  real_estate: '#d19a4e',
  precious: '#9d7cd8',
  currency: '#3ba5bd',
  debt: '#d65656'
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
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontSize: 12,
  fontWeight: 500
}

export function formatMoneyFull(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
