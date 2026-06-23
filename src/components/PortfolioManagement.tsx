// 资产管理页（第2个Tab）—— 纯持仓汇总视图，只读
// 按股票/基金分组，每组显示市值/盈亏/持仓数，可展开看明细
import { useState } from 'react'
import { Card, Table, Tag, Button, Collapse, Statistic, Row, Col, Spin, Alert } from 'antd'
import { StockOutlined, FundOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons'
import { usePortfolioStore, HoldingDetail } from '../stores/portfolioStore'
import { UP_COLOR, DOWN_COLOR } from '../utils/financeColor'
import type { ColumnsType } from 'antd/es/table'

const { Panel } = Collapse

export default function PortfolioManagement() {
  const { data, loading, error } = usePortfolioStore()
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['stock', 'fund'])

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" tip="加载持仓数据..." />
      </div>
    )
  }

  if (error && !data) {
    return <Alert type="error" message="加载失败" description={error} showIcon /> || null
  }

  const { stock, fund } = data?.byType || { stock: null, fund: null }
  const hasStock = (stock?.count || 0) > 0
  const hasFund = (fund?.count || 0) > 0

  const renderSummaryCard = (
    icon: React.ReactNode,
    title: string,
    typeLabel: string,
    typeColor: string,
    summary: NonNullable<typeof stock>
  ) => {
    const isProfit = summary.profit >= 0
    return (
      <Card
        size="small"
        style={{ marginBottom: 12, borderLeft: `4px solid ${typeColor}` }}
      >
        <Row gutter={16} align="middle">
          <Col span={4}>
            <Statistic
              title="持仓数量"
              value={summary.count}
              prefix={icon}
              valueStyle={{ fontSize: 18 }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="总市值"
              value={summary.marketValue}
              suffix="元"
              precision={2}
              valueStyle={{ fontSize: 16, color: '#1890ff' }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="总成本"
              value={summary.cost}
              suffix="元"
              precision={2}
              valueStyle={{ fontSize: 16, color: '#666' }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="浮动盈亏"
              value={Math.abs(summary.profit)}
              suffix={isProfit ? '盈利' : '亏损'}
              prefix={isProfit ? <RiseOutlined style={{ color: UP_COLOR }} /> : <FallOutlined style={{ color: DOWN_COLOR }} />}
              precision={2}
              valueStyle={{ fontSize: 16, color: isProfit ? UP_COLOR : DOWN_COLOR }}
            />
          </Col>
          <Col span={5}>
            <Statistic
              title="收益率"
              value={summary.profitPercent}
              suffix="%"
              prefix={isProfit ? <RiseOutlined style={{ color: UP_COLOR }} /> : <FallOutlined style={{ color: DOWN_COLOR }} />}
              precision={2}
              valueStyle={{ fontSize: 16, color: isProfit ? UP_COLOR : DOWN_COLOR }}
            />
          </Col>
        </Row>
      </Card>
    )
  }

  const renderHoldingTable = (holdings: HoldingDetail[]) => {
    const columns: ColumnsType<HoldingDetail> = [
      {
        title: '名称/代码',
        key: 'name',
        width: 160,
        render: (_, r) => (
          <div>
            <strong>{r.name}</strong>
            <div style={{ fontSize: 11, color: '#999' }}>{r.symbol}</div>
          </div>
        )
      },
      {
        title: '持仓数量',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 100,
        align: 'right' as const,
        render: v => v.toLocaleString()
      },
      {
        title: '成本价',
        dataIndex: 'avgCost',
        key: 'avgCost',
        width: 100,
        align: 'right' as const,
        render: v => `¥${v.toFixed(3)}`
      },
      {
        title: '当前价',
        dataIndex: 'currentPrice',
        key: 'currentPrice',
        width: 100,
        align: 'right' as const,
        render: v => `¥${v.toFixed(3)}`
      },
      {
        title: '市值',
        dataIndex: 'marketValue',
        key: 'marketValue',
        width: 120,
        align: 'right' as const,
        render: v => (
          <span style={{ color: '#1890ff' }}>¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
        )
      },
      {
        title: '浮动盈亏',
        key: 'profit',
        width: 130,
        align: 'right' as const,
        render: (_, r) => {
          const isProfit = r.profit >= 0
          return (
            <div>
              <span style={{ color: isProfit ? UP_COLOR : DOWN_COLOR, fontWeight: 'bold' }}>
                {isProfit ? '+' : ''}¥{r.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
              <div style={{ fontSize: 11, color: isProfit ? UP_COLOR : DOWN_COLOR }}>
                {isProfit ? '+' : ''}{r.profitPercent.toFixed(2)}%
              </div>
            </div>
          )
        }
      },
      {
        title: '更新时间',
        dataIndex: 'updateTime',
        key: 'updateTime',
        width: 140,
        render: t => t ? (
          <span style={{ fontSize: 11, color: '#999' }}>{t}</span>
        ) : '-'
      }
    ]
    return (
      <Table
        columns={columns}
        dataSource={holdings}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ x: 800 }}
      />
    )
  }

  const hasAny = hasStock || hasFund

  return (
    <Card title="🏦 资产管理（持仓汇总）" style={{ marginBottom: 16 }}>
      {!hasAny && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div>暂无持仓数据，请前往「持仓管理」添加</div>
        </div>
      )}

      {hasAny && (
        <Alert
          type="info"
          message="仅展示，数据来源于持仓管理。如需修改持仓，请前往「持仓管理」页面。"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Collapse
        activeKey={expandedKeys}
        onChange={(keys) => setExpandedKeys(keys as string[])}
      >
        {hasStock && (
          <Panel
            header={
              <span>
                <StockOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                📈 股票
                <Tag color="blue" style={{ marginLeft: 8 }}>{stock!.count} 只</Tag>
                <Tag color={stock!.profit >= 0 ? 'green' : 'red'} style={{ marginLeft: 4 }}>
                  {stock!.profit >= 0 ? '+' : ''}¥{stock!.profit.toFixed(2)}
                </Tag>
              </span>
            }
            key="stock"
          >
            {renderSummaryCard(<StockOutlined />, '股票', 'stock', '#1890ff', stock!)}
            {renderHoldingTable(stock!.holdings)}
          </Panel>
        )}

        {hasFund && (
          <Panel
            header={
              <span>
                <FundOutlined style={{ color: '#722ed1', marginRight: 8 }} />
                📊 基金
                <Tag color="purple" style={{ marginLeft: 8 }}>{fund!.count} 只</Tag>
                <Tag color={fund!.profit >= 0 ? 'green' : 'red'} style={{ marginLeft: 4 }}>
                  {fund!.profit >= 0 ? '+' : ''}¥{fund!.profit.toFixed(2)}
                </Tag>
              </span>
            }
            key="fund"
          >
            {renderSummaryCard(<FundOutlined />, '基金', 'fund', '#722ed1', fund!)}
            {renderHoldingTable(fund!.holdings)}
          </Panel>
        )}
      </Collapse>
    </Card>
  )
}
