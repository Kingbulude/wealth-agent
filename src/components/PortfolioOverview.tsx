// 资产总览页（第1个Tab）
// 4张汇总卡片 + 持仓分布饼图 + TOP10盈亏柱状图
// 数据全来自 portfolioStore（统一数据源）

import { Card, Statistic, Row, Col, Spin, Alert } from 'antd'
import {
  AreaChartOutlined,
  RiseOutlined,
  FallOutlined,
  StockOutlined
} from '@ant-design/icons'
import { usePortfolioStore } from '../stores/portfolioStore'
import PortfolioPieChart from './PortfolioPieChart'
import PortfolioBarChart from './PortfolioBarChart'

export default function PortfolioOverview() {
  const { data, loading, error, lastFetchedAt, refreshing } = usePortfolioStore()
  const s = data?.summary

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" tip="加载持仓数据..." />
      </div>
    )
  }

  if (error && !data) {
    return (
      <Alert
        type="error"
        message="加载失败"
        description={error}
        showIcon
        style={{ marginBottom: 16 }}
      />
    )
  }

  const hasHoldings = (s?.stockCount || 0) + (s?.fundCount || 0) > 0

  if (!hasHoldings) {
    return (
      <Card title="📊 资产总览" style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
          <div style={{ fontSize: 16 }}>暂无持仓数据</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>
            请前往「持仓管理」添加股票或基金
          </div>
        </div>
      </Card>
    )
  }

  const isProfit = (s?.totalProfit || 0) >= 0

  return (
    <>
      {/* 4张汇总卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="💰 总市值"
              value={s?.totalMarketValue || 0}
              prefix={<AreaChartOutlined style={{ color: '#1890ff' }} />}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
              loading={loading}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="📈 总浮动盈亏"
              value={Math.abs(s?.totalProfit || 0)}
              prefix={isProfit ? <RiseOutlined style={{ color: '#52c41a' }} /> : <FallOutlined style={{ color: '#f5222d' }} />}
              suffix={isProfit ? '盈利' : '亏损'}
              precision={2}
              valueStyle={{ color: isProfit ? '#52c41a' : '#f5222d', fontSize: 22 }}
              loading={loading}
            />
            <div style={{ textAlign: 'right', fontSize: 12, color: '#999', marginTop: 4 }}>
              {refreshing && <span style={{ color: '#faad14' }}>刷新中...</span>}
              {!refreshing && lastFetchedAt && (
                <span>{new Date(lastFetchedAt).toLocaleTimeString('zh-CN', { hour12: false })} 更新</span>
              )}
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="📊 盈亏比例"
              value={s?.totalProfitPercent || 0}
              suffix="%"
              precision={2}
              prefix={isProfit ? <RiseOutlined style={{ color: '#52c41a' }} /> : <FallOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: isProfit ? '#52c41a' : '#f5222d', fontSize: 22 }}
              loading={loading}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="🏦 持仓数量"
              value={(s?.stockCount || 0) + (s?.fundCount || 0)}
              prefix={<StockOutlined style={{ color: '#722ed1' }} />}
              suffix={`只（股${s?.stockCount || 0}/基${s?.fundCount || 0}）`}
              valueStyle={{ color: '#722ed1', fontSize: 22 }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="📊 持仓分布" extra={<span style={{ fontSize: 12, color: '#999' }}>按持仓市值</span>}>
            {data && <PortfolioPieChart data={data} height={320} />}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="📈 盈亏排行 TOP10" extra={<span style={{ fontSize: 12, color: '#999' }}>按浮动盈亏金额</span>}>
            {data && <PortfolioBarChart data={data} height={320} />}
          </Card>
        </Col>
      </Row>
    </>
  )
}
