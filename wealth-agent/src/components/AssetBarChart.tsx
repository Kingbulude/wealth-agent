import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { Asset, ASSET_TYPE_META } from '../types/asset'

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

    const ASSET_COLORS: Record<string, string> = {
      cash: '#52c41a',
      stock: '#1890ff',
      fund: '#722ed1',
      real_estate: '#fa8c16',
      debt: '#f5222d'
    }

    const CURRENCY_RATES: Record<string, number> = {
      CNY: 1, USD: 7.2, EUR: 7.8, HKD: 0.92, JPY: 0.048
    }

    // 转换为CNY并按类型分组
    const distribution: Record<string, number> = {}
    assets.forEach(asset => {
      const cnyAmount = asset.amount * (CURRENCY_RATES[asset.currency] || 1)
      distribution[asset.type] = (distribution[asset.type] || 0) + cnyAmount
    })

    const categories = Object.keys(distribution).map(
      type => ASSET_TYPE_META[type as keyof typeof ASSET_TYPE_META]?.label || type
    )
    const values = Object.values(distribution).map(v => Math.round(v))

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
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 10000) {
              return `${(value / 10000).toFixed(0)}万`
            }
            return value.toString()
          }
        }
      },
      series: [
        {
          name: '金额',
          type: 'bar',
          barWidth: '60%',
          data: Object.keys(distribution).map((type, index) => ({
            value: values[index],
            itemStyle: { color: ASSET_COLORS[type] || '#999' }
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