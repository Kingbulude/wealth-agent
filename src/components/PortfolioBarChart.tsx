// 盈亏排行柱状图（资产总览页用）
// 按浮动盈亏金额排序 TOP10
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { PortfolioData } from '../stores/portfolioStore'

interface Props {
  data: PortfolioData
  height?: number
}

export default function PortfolioBarChart({ data, height = 320 }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }
    const chart = chartInstance.current

    const sorted = [...data.holdings]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10)

    const names = sorted.map(h => h.name.length > 6 ? h.name.slice(0, 5) + '…' : h.name)
    const profits = sorted.map(h => parseFloat(h.profit.toFixed(2)))

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0]
          const holding = sorted[p.dataIndex]
          return `${holding.name} (${holding.symbol})<br/>` +
            `市值: ¥${holding.marketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}<br/>` +
            `盈亏: <b style="color:${holding.profit >= 0 ? '#52c41a' : '#f5222d'}">` +
            `${holding.profit >= 0 ? '+' : ''}¥${holding.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</b><br/>` +
            `收益率: <b style="color:${holding.profitPercent >= 0 ? '#52c41a' : '#f5222d'}">` +
            `${holding.profitPercent >= 0 ? '+' : ''}${holding.profitPercent.toFixed(2)}%</b>`
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: { fontSize: 11, interval: 0, rotate: 30 }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => v >= 0 ? `+¥${(v / 1000).toFixed(0)}k` : `-¥${Math.abs(v) / 1000}k`
        }
      },
      series: [{
        type: 'bar',
        data: profits.map(p => ({
          value: p,
          itemStyle: {
            color: p >= 0 ? '#52c41a' : '#f5222d',
            borderRadius: p >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]
          }
        })),
        barMaxWidth: 40
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
