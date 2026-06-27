import { useMemo, useState } from 'react'
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

const renderLegend = (props: any, activeIndex: number | null, setActiveIndex: (i: number | null) => void) => {
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
        <div
          key={`legend-${index}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            opacity: activeIndex === null || activeIndex === index ? 1 : 0.4,
            transition: 'opacity 0.2s ease',
            fontWeight: activeIndex === index ? 600 : 500
          }}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: entry.color,
            boxShadow: activeIndex === index ? `0 0 8px ${entry.color}` : 'none',
            transition: 'box-shadow 0.2s ease'
          }} />
          <span style={{
            fontSize: 12,
            color: activeIndex === index ? '#1a1d2e' : '#5a6072',
            transition: 'color 0.2s ease'
          }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function IndustryDonutChart({ holdings, height = 340 }: IndustryDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
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
            {data.map((entry, index) => (
              <filter
                key={`glow-${index}`}
                id={`industry-glow-${index}`}
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>
          <Tooltip
            content={<CustomTooltip />}
            cursor={false}
          />
          <Legend
            content={(props: any) => renderLegend(props, activeIndex, setActiveIndex)}
            verticalAlign="bottom"
            height={40}
          />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            activeIndex={activeIndex ?? undefined}
            activeShape={(props: any) => {
              const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index } = props
              const scale = 1.05
              return (
                <path
                  d={describeArc(cx, cy, outerRadius * scale, innerRadius * scale, startAngle, endAngle)}
                  fill={fill}
                  stroke="#fff"
                  strokeWidth={2}
                  filter={`url(#industry-glow-${index})`}
                  style={{ transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              )
            }}
            paddingAngle={2}
            dataKey="value"
            animationDuration={800}
            animationEasing="ease-out"
            stroke="#fff"
            strokeWidth={2}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`url(#industry-gradient-${index})`}
                style={{
                  opacity: activeIndex === null || activeIndex === index ? 1 : 0.4,
                  transition: 'opacity 0.2s ease'
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function describeArc(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const startAngleDeg = startAngle * (180 / Math.PI)
  const endAngleDeg = endAngle * (180 / Math.PI)
  
  const start = polarToCartesian(cx, cy, outerR, endAngleDeg)
  const end = polarToCartesian(cx, cy, outerR, startAngleDeg)
  const innerStart = polarToCartesian(cx, cy, innerR, startAngleDeg)
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngleDeg)
  const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1'

  return [
    'M', start.x, start.y,
    'A', outerR, outerR, 0, largeArcFlag, 0, end.x, end.y,
    'L', innerStart.x, innerStart.y,
    'A', innerR, innerR, 0, largeArcFlag, 1, innerEnd.x, innerEnd.y,
    'Z'
  ].join(' ')
}

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians)
  }
}
