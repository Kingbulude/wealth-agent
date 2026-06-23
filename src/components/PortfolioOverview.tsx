// 资产总览页
// 数据来源：assetStore（手动资产） + holdingStore（持仓联动）
// 特点：不依赖后端 /api/portfolio/summary，纯前端合并，确保一定能显示

import { Card, Statistic, Row, Col, Tag, Tooltip, Progress } from 'antd'
import {
  WalletOutlined,
  BankOutlined,
  CreditCardOutlined,
  RiseOutlined,
  FallOutlined,
  InfoCircleOutlined,
  AreaChartOutlined,
  StockOutlined
} from '@ant-design/icons'
import { useEffect, useMemo } from 'react'
import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { WealthCalculator } from '../utils/wealthCalculator'
import AssetPieChart from './AssetPieChart'
import AssetBarChart from './AssetBarChart'

export default function PortfolioOverview() {
  const { assets, loadAssets } = useAssetStore()
  const { holdings, loadHoldings, refreshing } = useHoldingStore()
  const { data: portfolioData, loadPortfolio } = usePortfolioStore()

  useEffect(() => {
    loadAssets()
    loadPortfolio()
  }, [])

  // 合并持仓市值到投资资产分类
  const mergedAssets = useMemo(() => {
    const merged = [...assets]

    // 1) 替换现有同 symbol 的投资资产金额
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i]
      if (a.category === 'investment' && (a.type === 'stock' || a.type === 'fund') && a.symbol) {
        const holding = holdings.find(h => h.symbol === a.symbol && h.type === a.type)
        if (holding && holding.currentPrice > 0) {
          merged[i] = {
            ...a,
            amount: holding.currentPrice * holding.quantity,
            name: `${holding.name}（联动）`,
            isLinked: true
          }
        }
      }
    }

    // 2) 持仓中有但资产里没有的，添加虚拟条目
    for (const h of holdings) {
      if (!h.symbol) continue
      const exists = merged.find(a =>
        a.category === 'investment' &&
        a.type === h.type &&
        a.symbol === h.symbol
      )
      if (!exists) {
        const marketValue = (h.currentPrice || h.avgCost) * h.quantity
        merged.push({
          id: `linked-${h.id}`,
          userId: '',
          category: 'investment',
          type: h.type,
          name: `${h.name}（联动）`,
          symbol: h.symbol,
          amount: marketValue,
          currency: 'CNY',
          description: `🔗 联动持仓`,
          createdAt: h.lastUpdated || new Date().toISOString(),
          updatedAt: h.lastUpdated || new Date().toISOString(),
          isLinked: true
        })
      }
    }

    return merged
  }, [assets, holdings])

  const summary = WealthCalculator.calculateSummary(mergedAssets)

  const hasHoldings = holdings.length > 0
  const portfolioSummary = portfolioData?.summary ?? null
  const isProfit = (portfolioSummary?.totalProfit ?? 0) >= 0

  // 数据是否已加载（持仓和汇总数据都就绪）
  const dataReady = portfolioData !== null

  return (
    <>
      {/* 持仓联动摘要（实时）—— 等 portfolioData 加载完再显示，避免数据不完整 */}
      {hasHoldings && dataReady && (
        <Card
          size="small"
          title={
            <span>
              <StockOutlined style={{ color: '#1890ff', marginRight: 8 }} />
              🔗 持仓联动（实时）
              <Tag color="cyan" style={{ marginLeft: 8 }}>来自持仓管理</Tag>
              {refreshing && <span style={{ color: '#faad14', fontSize: 12, marginLeft: 8 }}>刷新中…</span>}
            </span>
          }
          style={{ marginBottom: 16, borderLeft: '4px solid #1890ff' }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="持仓总市值"
                value={portfolioSummary.totalValue}
                prefix={<AreaChartOutlined style={{ color: '#1890ff' }} />}
                suffix="元"
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="浮动盈亏"
                value={Math.abs(portfolioSummary.totalProfit)}
                prefix={isProfit ?
                  <RiseOutlined style={{ color: '#52c41a' }} /> :
                  <FallOutlined style={{ color: '#f5222d' }} />
                }
                suffix={isProfit ? '盈利' : '亏损'}
                precision={2}
                valueStyle={{ color: isProfit ? '#52c41a' : '#f5222d', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="收益率"
                value={portfolioSummary.profitPercent}
                suffix="%"
                precision={2}
                prefix={isProfit ?
                  <RiseOutlined style={{ color: '#52c41a' }} /> :
                  <FallOutlined style={{ color: '#f5222d' }} />
                }
                valueStyle={{ color: isProfit ? '#52c41a' : '#f5222d', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="持仓数量"
                value={holdings.length}
                prefix={<StockOutlined style={{ color: '#722ed1' }} />}
                suffix={`（股${portfolioSummary.stockCount}/基${portfolioSummary.fundCount}）`}
                valueStyle={{ color: '#722ed1', fontSize: 18 }}
              />
            </Col>
          </Row>
          <div style={{ fontSize: 12, color: '#999', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e8e8e8' }}>
            💡 提示：下方「投资资产」分类中的股票/基金市值已自动与持仓管理同步。
            在持仓管理添加/修改/删除后，数据会自动更新到所有页面。
          </div>
        </Card>
      )}

      {/* 原版：净资产 4 卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="净资产"
              value={summary.totalNetWorth}
              prefix={<WalletOutlined style={{ color: '#1890ff' }} />}
              suffix="元"
              precision={2}
              valueStyle={{
                color: summary.totalNetWorth >= 0 ? '#1890ff' : '#f5222d',
                fontSize: 24
              }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="总资产"
              value={summary.totalAssets}
              prefix={<BankOutlined style={{ color: '#52c41a' }} />}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="总负债"
              value={summary.totalLiabilities}
              prefix={<CreditCardOutlined style={{ color: '#f5222d' }} />}
              suffix="元"
              precision={2}
              valueStyle={{ color: '#f5222d', fontSize: 24 }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card
            extra={
              <div style={{ textAlign: 'right' }}>
                <Progress
                  percent={summary.liquidityScore}
                  showInfo={false}
                  strokeColor="#722ed1"
                  size="small"
                  style={{ width: 80, marginBottom: 4 }}
                />
                <div style={{ fontSize: 12, color: '#999' }}>
                  {summary.liquidityScore >= 80 ? '流动性优秀' :
                    summary.liquidityScore >= 60 ? '流动性良好' :
                      summary.liquidityScore >= 40 ? '流动性一般' : '流动性较差'}
                </div>
              </div>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Statistic
                title="流动性评分"
                value={summary.liquidityScore}
                prefix={<RiseOutlined style={{ color: '#722ed1' }} />}
                suffix="分"
                precision={1}
                valueStyle={{ color: '#722ed1', fontSize: 24 }}
              />
              <Tooltip
                title={
                  <div style={{ fontSize: 12 }}>
                    <div><strong>评分规则：</strong></div>
                    <div>• 现金/存款：权重5（满分）</div>
                    <div>• 股票：权重4</div>
                    <div>• 投资资产：权重3.5</div>
                    <div>• 基金：权重3</div>
                    <div>• 贵金属/收藏：权重2</div>
                    <div>• 房产：权重1</div>
                    <div><br/><strong>计算公式：</strong></div>
                    <div>Σ(资产占比 × 流动性权重/5 × 100)</div>
                  </div>
                }
                placement="bottom"
              >
                <InfoCircleOutlined style={{ color: '#999', fontSize: 14, cursor: 'help' }} />
              </Tooltip>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <div style={{ marginTop: 24 }}>
        <Card
          title="资产分布"
          style={{ marginBottom: 16 }}
          extra={<Tag color="cyan">已合并持仓市值</Tag>}
        >
          <AssetPieChart assets={mergedAssets} height={350} />
        </Card>

        <Card title="资产构成" extra={<Tag color="cyan">已合并持仓市值</Tag>}>
          <AssetBarChart assets={mergedAssets} height={300} />
        </Card>
      </div>
    </>
  )
}
