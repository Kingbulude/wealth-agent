import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { Asset, ASSET_CATEGORY_META } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'

interface AssetPieChartProps {
  assets: Asset[]
  height?: number
}

export default function AssetPieChart({ assets, height = 300 }: AssetPieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const { customTypes } = useAssetStore()

  useEffect(() => {
    if (!chartRef.current) return

    // 初始化图表
    chartInstance.current = echarts.init(chartRef.current)

    const CURRENCY_RATES: Record<string, number> = {
      CNY: 1, USD: 7.2, EUR: 7.8, HKD: 0.92, JPY: 0.048
    }

    // 按一级分类分组（排除负债）
    const distribution: Record<string, number> = {}
    assets.forEach(asset => {
      if (asset.category !== 'debt') {
        const cnyAmount = asset.amount * (CURRENCY_RATES[asset.currency] || 1)
        distribution[asset.category] = (distribution[asset.category] || 0) + cnyAmount
      }
    })

    // 转换为ECharts数据格式
    const chartData = Object.entries(distribution).map(([category, value]) => {
      const meta = ASSET_CATEGORY_META[category as keyof typeof ASSET_CATEGORY_META]
      const label = meta?.label ? meta.label.split(' ')[1] : category
      return {
        name: label || '未分类',
        value: Math.round(value * 100) / 100,
        itemStyle: { color: meta?.color || '#999' }
      }
    })

    // 配置图表
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `${params.name}<br/>
            金额: ¥${params.value.toLocaleString()}<br/>
            占比: ${params.percent.toFixed(1)}%`
        }
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle'
      },
      series: [
        {
          name: '资产分布',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}: {d}%'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: true
          },
          data: chartData.length > 0 ? chartData : [{ name: '暂无数据', value: 0 }]
        }
      ]
    }

    chartInstance.current.setOption(option)

    // 响应窗口变化
    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    // 清理
    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
    }
  }, [assets, customTypes])

  return <div ref={chartRef} style={{ width: '100%', height }} />
}
