// 资产类型定义
export type AssetCategory = 'cash' | 'investment' | 'real_estate' | 'precious' | 'currency' | 'debt'
export type AssetSubType =
  // 现金及储蓄
  | 'demand_deposit' | 'time_deposit' | 'cd' | 'money_fund' | 'bank_financial'
  // 投资资产
  | 'stock' | 'bond' | 'fund' | 'trust' | 'private_fund'
  // 房产土地
  | 'self_living_house' | 'investment_house' | 'land'
  // 贵金属与收藏
  | 'gold' | 'silver' | 'collectibles'
  // 外汇与数字货币
  | 'usd' | 'hkd' | 'other_currency' | 'crypto'
  // 负债
  | 'housing_loan' | 'car_loan' | 'consumer_loan' | 'credit_card' | 'other_debt'

export interface Asset {
  id: string
  userId: string
  category: AssetCategory  // 一级分类
  type: AssetSubType       // 二级分类
  name: string
  amount: number  // 金额（元）
  currency: string  // 货币：CNY, USD, EUR, HKD, JPY
  description?: string
  createdAt: string
  updatedAt: string
}

export interface AssetFormData {
  category: AssetCategory
  type: AssetSubType
  name: string
  amount: number
  currency: string
  description?: string
}

// 一级分类元数据
export const ASSET_CATEGORY_META: Record<AssetCategory, { label: string; icon: string; color: string }> = {
  cash: { label: '💰 现金及储蓄', icon: '💰', color: '#52c41a' },
  investment: { label: '📈 投资资产', icon: '📈', color: '#1890ff' },
  real_estate: { label: '🏠 房产土地', icon: '🏠', color: '#fa8c16' },
  precious: { label: '🪙 贵金属与收藏', icon: '🪙', color: '#722ed1' },
  currency: { label: '💱 外汇与数字货币', icon: '💱', color: '#13c2c2' },
  debt: { label: '💳 负债', icon: '💳', color: '#f5222d' }
}

// 二级分类元数据
export const ASSET_SUBTYPE_META: Record<AssetSubType, { label: string; icon: string; category: AssetCategory }> = {
  // 现金及储蓄
  demand_deposit: { label: '活期存款', icon: '🏦', category: 'cash' },
  time_deposit: { label: '定期存款', icon: '📅', category: 'cash' },
  cd: { label: '大额存单', icon: '💎', category: 'cash' },
  money_fund: { label: '货币基金', icon: '💵', category: 'cash' },
  bank_financial: { label: '银行理财', icon: '🏛️', category: 'cash' },

  // 投资资产
  stock: { label: '股票', icon: '📈', category: 'investment' },
  bond: { label: '债券/国债', icon: '📜', category: 'investment' },
  fund: { label: '基金', icon: '📊', category: 'investment' },
  trust: { label: '信托', icon: '⚖️', category: 'investment' },
  private_fund: { label: '私募基金', icon: '🔒', category: 'investment' },

  // 房产土地
  self_living_house: { label: '自住房产', icon: '🏡', category: 'real_estate' },
  investment_house: { label: '投资房产', icon: '🏬', category: 'real_estate' },
  land: { label: '土地', icon: '🌍', category: 'real_estate' },

  // 贵金属与收藏
  gold: { label: '黄金', icon: '🥇', category: 'precious' },
  silver: { label: '白银', icon: '🥈', category: 'precious' },
  collectibles: { label: '收藏品', icon: '🎨', category: 'precious' },

  // 外汇与数字货币
  usd: { label: '美元', icon: '💵', category: 'currency' },
  hkd: { label: '港币', icon: '🏪', category: 'currency' },
  other_currency: { label: '其他外币', icon: '🌐', category: 'currency' },
  crypto: { label: '数字货币', icon: '₿', category: 'currency' },

  // 负债
  housing_loan: { label: '房屋贷款', icon: '🏦', category: 'debt' },
  car_loan: { label: '汽车贷款', icon: '🚗', category: 'debt' },
  consumer_loan: { label: '消费贷款', icon: '💳', category: 'debt' },
  credit_card: { label: '信用卡', icon: '💳', category: 'debt' },
  other_debt: { label: '其他负债', icon: '📋', category: 'debt' }
}

// 货币选项
export const CURRENCY_OPTIONS = [
  { label: '🇨🇳 人民币 (CNY)', value: 'CNY', rate: 1 },
  { label: '🇺🇸 美元 (USD)', value: 'USD', rate: 7.2 },
  { label: '🇪🇺 欧元 (EUR)', value: 'EUR', rate: 7.8 },
  { label: '🇭🇰 港币 (HKD)', value: 'HKD', rate: 0.92 },
  { label: '🇯🇵 日元 (JPY)', value: 'JPY', rate: 0.048 }
]

// 获取某分类下的所有子类型
export function getSubtypesByCategory(category: AssetCategory): AssetSubType[] {
  return Object.entries(ASSET_SUBTYPE_META)
    .filter(([_, meta]) => meta.category === category)
    .map(([key]) => key as AssetSubType)
}

// 转换为旧格式（兼容现有代码）
export function toLegacyType(type: AssetSubType): string {
  const mapping: Record<string, string> = {
    demand_deposit: 'cash',
    time_deposit: 'cash',
    cd: 'cash',
    money_fund: 'cash',
    bank_financial: 'cash',
    stock: 'stock',
    bond: 'stock',
    fund: 'fund',
    trust: 'stock',
    private_fund: 'stock',
    self_living_house: 'real_estate',
    investment_house: 'real_estate',
    land: 'real_estate',
    gold: 'cash',
    silver: 'cash',
    collectibles: 'cash',
    usd: 'cash',
    hkd: 'cash',
    other_currency: 'cash',
    crypto: 'stock',
    housing_loan: 'debt',
    car_loan: 'debt',
    consumer_loan: 'debt',
    credit_card: 'debt',
    other_debt: 'debt'
  }
  return mapping[type] || 'cash'
}
