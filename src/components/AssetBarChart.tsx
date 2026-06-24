import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Asset } from '../types/asset'
import {
  ASSET_CATEGORY_COLORS,
  ASSET_CATEGORY_LABELS,
  CHART_FONT,
  CHART_COLORS,
  formatMoney,
  formatMoneyFull
} from '../utils/chartTheme'

interface AssetBarChartProps {
  assets: Asset[]
  height?: number
}

interface ChartDataItem {
  name: string
  category: string
  current: number
  recommended: number
  currentPercent: number
  recommendedPercent: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload as ChartDataItem
    return (
      <div style={{
        background: '#fff',
        border: '1px solid #eef0f4',
        borderRadius: 10,
        padding: '12px 16px',
        boxShadow: '0 6px 24px rgba(15, 20, 36, 0.08)',
        fontFamily: CHART_FONT.fontFamily,
        minWidth: 200
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#1a1d2e',
          marginBottom: 10
        }}>
          {label}
        </div>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: index < payload.length - 1 ? 6 : 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: entry.color
              }} />
              <span style={{ fontSize: 12, color: '#5a6072' }}>
                {entry.name === 'current' ? '当前配置' : '推荐配置'}
              </span>
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
              fontSize: 12,
              fontWeight: 600,
              color: '#1a1d2e'
            }}>
              {formatMoneyFull(entry.value)}
              <span style={{
                color: '#8a8f9f',
                fontWeight: 500,
                marginLeft: 4
              }}>
                ({entry.name === 'current' ? data.currentPercent : data.recommendedPercent}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const renderLegend = (props: any) => {
  const { payload } = props
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 12,
      fontFamily: CHART_FONT.fontFamily
    }}>
      {payload.map((entry: any, index: number) => (
        <div key={`legend-${index}`} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer'
        }}>
          <span style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: entry.color
          }} />
          <span style={{
            fontSize: 12,
            color: '#5a6072',
            fontWeight: 500
          }}>
            {entry.value === 'current' ? '当前配置' : '推荐配置'}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AssetBarChart({ assets, height = 340 }: AssetBarChartProps) {
  const data = useMemo(() => {
    const CURRENCY_RATES: Record<string, number> = {
      CNY: 1, USD: 7.2, EUR: 7.8, HKD: 0.92, JPY: 0.048
    }

    const distribution: Record<string, number> = {}
    let totalAssets = 0

    assets.forEach(asset => {
      if (asset.category !== 'debt') {
        const cnyAmount = asset.amount * (CURRENCY_RATES[asset.currency] || 1)
        distribution[asset.category] = (distribution[asset.category] || 0) + cnyAmount
        totalAssets += cnyAmount
      }
    })

    const categories = Object.keys(distribution)
    const hasInvestment = categories.includes('investment')
    const hasCash = categories.includes('cash')

    const recommended: Record<string, number> = {}
    if (hasInvestment && totalAssets > 0) {
      recommended['investment'] = totalAssets * 0.40
      recommended['cash'] = totalAssets * 0.20
    }

    const allCategories = [...new Set([...categories, ...Object.keys(recommended)])]

    return allCategories.map(category => {
      const currentValue = distribution[category] || 0
      const recommendedValue = recommended[category] || 0
      return {
        name: ASSET_CATEGORY_LABELS[category] || category,
        category,
        current: Math.round(currentValue),
        recommended: Math.round(recommendedValue),
        currentPercent: totalAssets > 0 ? Number(((currentValue / totalAssets) * 100).toFixed(1)) : 0,
        recommendedPercent: totalAssets > 0 ? Number(((recommendedValue / totalAssets) * 100).toFixed(1)) : 0
      }
    }).filter(item => item.current > 0 || item.recommended > 0)
  }, [assets])

  const maxValue = useMemo(() => {
    if (data.length === 0) return 100
    const max = Math.max(...data.map(d => Math.max(d.current, d.recommended)))
    return Math.ceil(max * 1.15)
  }, [data])

  if (data.length === 0) {
    return (
      <div style={{
        width: '100%',
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8a8f9f',
        fontSize: 13
      }}>
        暂无资产数据
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
          barGap={8}
        >
          <defs>
            <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.current} stopOpacity={1} />
              <stop offset="100%" stopColor={CHART_COLORS.current} stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="recommendedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.recommended} stopOpacity={1} />
              <stop offset="100%" stopColor={CHART_COLORS.recommended} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#eef0f4"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            axisLine={{ stroke: '#eef0f4' }}
            tickLine={false}
            tick={{
              fill: '#5a6072',
              fontSize: 11,
              fontFamily: CHART_FONT.fontFamily
            }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{
              fill: '#8a8f9f',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', 'SF Mono', 'Menlo', monospace"
            }}
            tickFormatter={(value) => formatMoney(value)}
            domain={[0, maxValue]}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(201, 167, 106, 0.06)' }}
          />
          <Legend
            content={renderLegend}
            verticalAlign="top"
            height={36}
          />
          <Bar
            dataKey="current"
            name="current"
            radius={[6, 6, 0, 0]}
            animationDuration={800}
            animationEasing="ease-out"
            maxBarSize={40}
          >
            {data.map((_, index) => (
              <Cell key={`current-${index}`} fill="url(#currentGradient)" />
            ))}
          </Bar>
          <Bar
            dataKey="recommended"
            name="recommended"
            radius={[6, 6, 0, 0]}
            animationDuration={800}
            animationEasing="ease-out"
            animationBegin={200}
            maxBarSize={40}
          >
            {data.map((_, index) => (
              <Cell key={`recommended-${index}`} fill="url(#recommendedGradient)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
