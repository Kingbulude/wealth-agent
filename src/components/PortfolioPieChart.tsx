// 持仓分布饼图（资产总览页用）
// 数据来源：portfolioStore
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { PortfolioData } from '../stores/portfolioStore'

interface Props {
  data: PortfolioData
  height?: number
}

export default function PortfolioPieChart({ data, height = 320 }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }
    const chart = chartInstance.current

    const allHoldings = data.holdings
      .filter(h => h.marketValue > 0)
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, 10) // TOP10

    const total = allHoldings.reduce((s, h) => s + h.marketValue, 0)

    const pieData = allHoldings.map(h => ({
      name: `${h.name} (${h.symbol})`,
      value: parseFloat(h.marketValue.toFixed(2))
    }))

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/>¥${p.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}<br/>${p.percent.toFixed(1)}%`
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: 'middle',
        textStyle: { fontSize: 11 }
      },
      series: [{
        type: 'pie',
        radius: ['35%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold' }
        },
        data: pieData,
        color: ['#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2', '#faad14', '#eb2f96', '#52c41a', '#1890ff']
      }],
      graphic: [{
        type: 'text',
        left: '35%',
        top: '45%',
        style: {
          text: `¥${(total / 10000).toFixed(1)}万`,
          textAlign: 'center',
          fill: '#333',
          fontSize: 14,
          fontWeight: 'bold'
        }
      }]
    }

    chart.setOption(option, true)
    return () => { chart.resize() }
  }, [data])

  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return <div ref={chartRef} style={{ width: '100%', height }} />
}
