import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { Asset, ASSET_TYPE_META } from '../types/asset'

interface AssetPieChartProps {
  assets: Asset[]
  height?: number
}

export default function AssetPieChart({ assets, height = 300 }: AssetPieChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    // 初始化图表
    chartInstance.current = echarts.init(chartRef.current)

    // 处理数据
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
      if (asset.type !== 'debt') {
        const cnyAmount = asset.amount * (CURRENCY_RATES[asset.currency] || 1)
        distribution[asset.type] = (distribution[asset.type] || 0) + cnyAmount
      }
    })

    // 转换为ECharts数据格式
    const chartData = Object.entries(distribution).map(([type, value]) => ({
      name: ASSET_TYPE_META[type as keyof typeof ASSET_TYPE_META]?.label || type,
      value: Math.round(value * 100) / 100,
      itemStyle: { color: ASSET_COLORS[type] || '#999' }
    }))

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
  }, [assets])

  return <div ref={chartRef} style={{ width: '100%', height }} />
}