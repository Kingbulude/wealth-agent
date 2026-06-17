export type AssetType = 'cash' | 'stock' | 'fund' | 'real_estate' | 'debt'

export interface Asset {
  id: string
  userId: string
  type: AssetType
  name: string
  amount: number  // 金额（元）
  currency: string  // 货币：CNY, USD, EUR, HKD, JPY
  description?: string
  createdAt: string
  updatedAt: string
}

export interface AssetFormData {
  type: AssetType
  name: string
  amount: number
  currency: string
  description?: string
}

// 资产类型元数据
export const ASSET_TYPE_META: Record<AssetType, { label: string; icon: string; color: string }> = {
  cash: { label: '现金/存款', icon: '💰', color: '#52c41a' },
  stock: { label: '股票', icon: '📈', color: '#1890ff' },
  fund: { label: '基金', icon: '📊', color: '#722ed1' },
  real_estate: { label: '房产', icon: '🏠', color: '#fa8c16' },
  debt: { label: '负债', icon: '💳', color: '#f5222d' }
}

export const CURRENCY_OPTIONS = [
  { label: '人民币 (CNY)', value: 'CNY', rate: 1 },
  { label: '美元 (USD)', value: 'USD', rate: 7.2 },
  { label: '欧元 (EUR)', value: 'EUR', rate: 7.8 },
  { label: '港币 (HKD)', value: 'HKD', rate: 0.92 },
  { label: '日元 (JPY)', value: 'JPY', rate: 0.048 }
]