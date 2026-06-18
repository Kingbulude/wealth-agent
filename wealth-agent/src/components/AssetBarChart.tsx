import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { Asset, ASSET_CATEGORY_META } from '../types/asset'

interface AssetBarChartProps {
  assets: Asset[]
  height?: number
}

export default function AssetBarChart({ assets, height = 250 }: AssetBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    chartInstance.current = echarts.init(chartRef.current)

    const CURRENCY_RATES: Record<string, number> = {
      CNY: 1, USD: 7.2, EUR: 7.8, HKD: 0.92, JPY: 0.048
    }

    // 按一级分类分组
    const distribution: Record<string, number> = {}
    assets.forEach(asset => {
      const cnyAmount = asset.amount * (CURRENCY_RATES[asset.currency] || 1)
      distribution[asset.category] = (distribution[asset.category] || 0) + cnyAmount
    })

    const categories = Object.entries(distribution).map(([category]) => {
      const meta = ASSET_CATEGORY_META[category as keyof typeof ASSET_CATEGORY_META]
      return meta?.label.split(' ')[1] || category
    })
    const values = Object.values(distribution).map(v => Math.round(v))

    // 获取颜色
    const colors = Object.keys(distribution).map(category => {
      const meta = ASSET_CATEGORY_META[category as keyof typeof ASSET_CATEGORY_META]
      return meta?.color || '#999'
    })

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0]
          return `${data.name}<br/>金额: ¥${data.value.toLocaleString()}`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          interval: 0,
          rotate: 0
        }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 100000) {
              return `${(value / 10000).toFixed(1)}万`
            }
            if (value >= 10000) {
              return `${(value / 10000).toFixed(0)}万`
            }
            return value.toLocaleString()
          }
        }
      },
      series: [
        {
          name: '金额',
          type: 'bar',
          barWidth: '60%',
          data: values.map((value, index) => ({
            value,
            itemStyle: { color: colors[index] }
          })),
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => {
              if (params.value >= 10000) {
                return `${(params.value / 10000).toFixed(1)}万`
              }
              return params.value.toLocaleString()
            }
          }
        }
      ]
    }

    chartInstance.current.setOption(option)

    const handleResize = () => chartInstance.current?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
    }
  }, [assets])

  return <div ref={chartRef} style={{ width: '100%', height }} />
}
