import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'
import { Holding } from '../types/holding'
import { classifyHoldingsByIndustry, IndustryData } from '../utils/industryClassifier'
import { CHART_FONT, formatMoneyFull } from '../utils/chartTheme'

interface IndustryDonutChartProps {
  holdings: Holding[]
  height?: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as IndustryData
    return (
      <div style={{
        background: '#fff',
        border: '1px solid #eef0f4',
        borderRadius: 10,
        padding: '12px 16px',
        boxShadow: '0 6px 24px rgba(15, 20, 36, 0.08)',
        fontFamily: CHART_FONT.fontFamily,
        minWidth: 160
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: data.color
          }} />
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#1a1d2e'
          }}>
            {data.name}
          </span>
        </div>
        <div style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#1a1d2e',
          fontFamily: "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
          marginBottom: 2
        }}>
          {formatMoneyFull(data.value)}
        </div>
        <div style={{
          fontSize: 12,
          color: '#8a8f9f'
        }}>
          占比 <span style={{ fontWeight: 600, color: '#5a6072' }}>{data.percentage.toFixed(2)}%</span>
        </div>
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
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: '8px 16px',
      marginTop: 8,
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
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: entry.color
          }} />
          <span style={{
            fontSize: 12,
            color: '#5a6072',
            fontWeight: 500
          }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function IndustryDonutChart({ holdings, height = 340 }: IndustryDonutChartProps) {
  const data = useMemo(() => classifyHoldingsByIndustry(holdings), [holdings])

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
        暂无持仓数据
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {data.map((entry, index) => (
              <linearGradient
                key={`gradient-${index}`}
                id={`industry-gradient-${index}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.75} />
              </linearGradient>
            ))}
          </defs>
          <Tooltip
            content={<CustomTooltip />}
            cursor={false}
          />
          <Legend
            content={renderLegend}
            verticalAlign="bottom"
            height={40}
          />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            animationDuration={800}
            animationEasing="ease-out"
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`url(#industry-gradient-${index})`}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
