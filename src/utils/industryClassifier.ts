import { Holding } from '../types/holding'

export interface IndustryData {
  name: string
  value: number
  percentage: number
  color: string
}

const INDUSTRY_COLORS: Record<string, string> = {
  '白酒/消费': '#d4a855',
  '科技/半导体': '#5a8fd9',
  '金融/银行': '#3d9a7a',
  '医药/医疗': '#a78bd6',
  '新能源': '#3ba5bd',
  '互联网/港股': '#d19a4e',
  '基金': '#8b5cf6',
  '其他': '#8a8f9f'
}

const CONSUMER_STOCKS = [
  '贵州茅台', '五粮液', '泸州老窖', '山西汾酒', '洋河股份',
  '海天味业', '伊利股份', '蒙牛乳业', '农夫山泉', '中国飞鹤',
  '美的集团', '格力电器', '海尔智家', '苏泊尔', '飞科电器',
  '安踏体育', '李宁', '波司登', '申洲国际',
  '中国中免', '王府井', '永辉超市', '高鑫零售'
]

const TECH_STOCKS = [
  '兆易创新', '中芯国际', '北方华创', '韦尔股份', '海康威视',
  '立讯精密', '歌尔股份', '蓝思科技', '工业富联', '闻泰科技',
  '紫光国微', '长电科技', '通富微电', '华天科技',
  '京东方A', 'TCL科技', '深天马A',
  '中兴通讯', '烽火通信', '亨通光电',
  '科大讯飞', '三六零', '用友网络', '金山办公',
  '寒武纪', '海光信息', '龙芯中科'
]

const FINANCE_STOCKS = [
  '招商银行', '平安银行', '宁波银行', '中国平安',
  '工商银行', '建设银行', '农业银行', '中国银行',
  '交通银行', '邮储银行', '兴业银行', '浦发银行',
  '中信证券', '华泰证券', '国泰君安', '海通证券',
  '中国太保', '中国人寿', '新华保险',
  '东方财富', '同花顺'
]

const PHARMA_STOCKS = [
  '恒瑞医药', '药明康德', '迈瑞医疗', '片仔癀',
  '云南白药', '同仁堂', '白云山', '华润三九',
  '智飞生物', '长春高新', '沃森生物', '泰格医药',
  '康龙化成', '凯莱英', '昭衍新药',
  '爱尔眼科', '通策医疗', '美年健康',
  '复星医药', '石药集团', '中国生物制药'
]

const NEW_ENERGY_STOCKS = [
  '宁德时代', '比亚迪', '隆基绿能', '阳光电源',
  '亿纬锂能', '天齐锂业', '赣锋锂业', '华友钴业',
  '通威股份', '晶澳科技', '天合光能', '晶科能源',
  '三峡能源', '龙源电力', '金风科技', '明阳智能',
  '恩捷股份', '星源材质', '天赐材料', '新宙邦',
  '汇川技术', '三花智控'
]

const INTERNET_STOCKS = [
  '腾讯控股', '阿里巴巴', '美团', '小米',
  '京东', '拼多多', '百度', '网易',
  '快手', '哔哩哔哩', '贝壳', '京东健康',
  '阿里健康', '平安好医生', '携程集团',
  '新东方', '好未来'
]

function matchIndustry(name: string): string {
  const cleanName = name.replace(/（联动）/g, '').trim()

  if (CONSUMER_STOCKS.some(s => cleanName.includes(s))) return '白酒/消费'
  if (TECH_STOCKS.some(s => cleanName.includes(s))) return '科技/半导体'
  if (FINANCE_STOCKS.some(s => cleanName.includes(s))) return '金融/银行'
  if (PHARMA_STOCKS.some(s => cleanName.includes(s))) return '医药/医疗'
  if (NEW_ENERGY_STOCKS.some(s => cleanName.includes(s))) return '新能源'
  if (INTERNET_STOCKS.some(s => cleanName.includes(s))) return '互联网/港股'

  return '其他'
}

export function classifyHoldingsByIndustry(holdings: Holding[]): IndustryData[] {
  const industryMap: Record<string, number> = {}
  let totalValue = 0

  for (const h of holdings) {
    const value = (h.currentPrice || h.avgCost) * h.quantity
    totalValue += value

    if (h.type === 'fund') {
      industryMap['基金'] = (industryMap['基金'] || 0) + value
    } else {
      const industry = matchIndustry(h.name)
      industryMap[industry] = (industryMap[industry] || 0) + value
    }
  }

  const result: IndustryData[] = Object.entries(industryMap)
    .map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      color: INDUSTRY_COLORS[name] || INDUSTRY_COLORS['其他']
    }))
    .sort((a, b) => b.value - a.value)

  return result
}

export function getIndustryColor(name: string): string {
  return INDUSTRY_COLORS[name] || INDUSTRY_COLORS['其他']
}
