// 资产总览页（恢复原版逻辑：基于 assetStore）
// 持仓管理的数据通过联动展示：合并到资产总览
// - 「投资资产」分类下，股票/基金的市值自动用持仓实时市值覆盖
// - 同时显示一个「持仓浮动盈亏」摘要卡片（实时联动）

import { Card, Statistic, Row, Col, Spin, Alert, Tag, Tooltip, Progress } from 'antd'
import {
  WalletOutlined,
  BankOutlined,
  CreditCardOutlined,
  RiseOutlined,
  InfoCircleOutlined,
  AreaChartOutlined,
  StockOutlined
} from '@ant-design/icons'
import { useEffect } from 'react'
import { useAssetStore } from '../stores/assetStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { WealthCalculator } from '../utils/wealthCalculator'
import AssetPieChart from './AssetPieChart'
import AssetBarChart from './AssetBarChart'

export default function PortfolioOverview() {
  const { assets, loadAssets, customTypes } = useAssetStore()
  const { data: portfolioData, loadPortfolio, refreshing, lastFetchedAt } = usePortfolioStore()

  // 同时加载手动资产和持仓
  useEffect(() => {
    loadAssets()
    loadPortfolio()
  }, [])

  // 合并数据：把持仓实时市值叠加到投资资产中
  // 1) 把持仓按类型分组（stock/fund）
  // 2) 把 portfolioData 中同类型资产做替换（assetStore 中的 stock/fund 用持仓实时数据覆盖）
  // 3) 计算汇总时使用合并后的数据
  const mergedAssets = mergeHoldingsIntoAssets(assets, portfolioData)

  const summary = WealthCalculator.calculateSummary(mergedAssets)
  const portfolioSummary = portfolioData?.summary
  const hasHoldings = (portfolioSummary?.stockCount || 0) + (portfolioSummary?.fundCount || 0) > 0

  return (
    <>
      {/* 持仓联动摘要（实时） */}
      {hasHoldings && (
        <Card
          size="small"
          title={
            <span>
              <StockOutlined style={{ color: '#1890ff', marginRight: 8 }} />
              🔗 持仓联动（实时）
              <Tag color="cyan" style={{ marginLeft: 8 }}>来自持仓管理</Tag>
              {refreshing && <span style={{ color: '#faad14', fontSize: 12, marginLeft: 8 }}>刷新中…</span>}
              {!refreshing && lastFetchedAt && (
                <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                  {new Date(lastFetchedAt).toLocaleTimeString('zh-CN', { hour12: false })} 更新
                </span>
              )}
            </span>
          }
          style={{ marginBottom: 16, borderLeft: '4px solid #1890ff' }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="持仓总市值"
                value={portfolioSummary?.totalMarketValue || 0}
                prefix={<AreaChartOutlined style={{ color: '#1890ff' }} />}
                suffix="元"
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="浮动盈亏"
                value={Math.abs(portfolioSummary?.totalProfit || 0)}
                prefix={(portfolioSummary?.totalProfit || 0) >= 0 ?
                  <RiseOutlined style={{ color: '#52c41a' }} /> :
                  <RiseOutlined style={{ color: '#f5222d' }} style={{ transform: 'rotate(180deg)' }} />
                }
                suffix={(portfolioSummary?.totalProfit || 0) >= 0 ? '盈利' : '亏损'}
                precision={2}
                valueStyle={{
                  color: (portfolioSummary?.totalProfit || 0) >= 0 ? '#52c41a' : '#f5222d',
                  fontSize: 18
                }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="收益率"
                value={portfolioSummary?.totalProfitPercent || 0}
                suffix="%"
                precision={2}
                prefix={<RiseOutlined style={{ color: (portfolioSummary?.totalProfitPercent || 0) >= 0 ? '#52c41a' : '#f5222d' }} />}
                valueStyle={{
                  color: (portfolioSummary?.totalProfitPercent || 0) >= 0 ? '#52c41a' : '#f5222d',
                  fontSize: 18
                }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="持仓数量"
                value={(portfolioSummary?.stockCount || 0) + (portfolioSummary?.fundCount || 0)}
                prefix={<StockOutlined style={{ color: '#722ed1' }} />}
                suffix={`（股${portfolioSummary?.stockCount}/基${portfolioSummary?.fundCount}）`}
                valueStyle={{ color: '#722ed1', fontSize: 18 }}
              />
            </Col>
          </Row>
          <div style={{ fontSize: 12, color: '#999', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e8e8e8' }}>
            💡 提示：下方「投资资产」分类中的股票/基金市值已自动与持仓管理同步，无需手动维护。
            每 5 分钟自动刷新一次最新行情。
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

      {/* 原版：图表 */}
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

/**
 * 把持仓数据合并到 assets 数组中
 * - 找到所有 type='stock'/'fund' 的 Asset（投资资产分类）
 * - 用 portfolioData 中同 code 的持仓实时市值替换 amount
 * - 如资产中没有对应股票/基金条目，添加一个虚拟条目
 */
function mergeHoldingsIntoAssets(assets: any[], portfolioData: any): any[] {
  if (!portfolioData?.holdings?.length) return assets

  const merged = [...assets]
  // 把 portfolioData 的 holdings 按 symbol 分组
  const holdingsBySymbol = new Map<string, any>()
  for (const h of portfolioData.holdings) {
    // 同 symbol 多次出现时合并
    if (holdingsBySymbol.has(h.symbol)) {
      const prev = holdingsBySymbol.get(h.symbol)
      const newQty = prev.quantity + h.quantity
      const newCost = prev.avgCost * prev.quantity + h.avgCost * h.quantity
      holdingsBySymbol.set(h.symbol, {
        ...prev,
        quantity: newQty,
        avgCost: newCost / newQty,
        marketValue: prev.marketValue + h.marketValue,
        cost: prev.cost + h.cost,
        profit: prev.profit + h.profit
      })
    } else {
      holdingsBySymbol.set(h.symbol, h)
    }
  }

  // 第一遍：替换现有 stock/fund 资产
  let hasReplaced = new Set<string>()
  for (let i = 0; i < merged.length; i++) {
    const a = merged[i]
    if (a.category === 'investment' && (a.type === 'stock' || a.type === 'fund')) {
      const holding = holdingsBySymbol.get(a.symbol)
      if (holding) {
        // 用持仓实时市值覆盖
        merged[i] = {
          ...a,
          amount: holding.marketValue,
          name: `${holding.name}（联动）`,
          description: `持仓 ${holding.quantity} 股/份 @¥${holding.avgCost.toFixed(2)} → ¥${holding.currentPrice.toFixed(2)} | 盈亏 ${holding.profit >= 0 ? '+' : ''}¥${holding.profit.toFixed(2)}`,
          isLinked: true,
          _holding: holding
        }
        hasReplaced.add(a.symbol)
      } else if (a.isLinked) {
        // 之前联动过但持仓已删除，归零
        merged[i] = {
          ...a,
          amount: 0,
          name: `${a.name}（已清仓）`,
          description: '持仓已清空，市值归零',
          isLinked: false
        }
      }
    }
  }

  // 第二遍：持仓中有但资产里没的，添加虚拟条目
  for (const h of portfolioData.holdings) {
    if (hasReplaced.has(h.symbol)) continue
    // 检查是否已存在虚拟条目
    const existing = merged.find(a => a.category === 'investment' && a.type === h.type && a.symbol === h.symbol)
    if (existing) {
      // 已存在（已替换过），跳过
      continue
    }
    merged.push({
      id: `linked-${h.id}`,
      userId: '',
      category: 'investment',
      type: h.type,
      name: `${h.name}（联动）`,
      symbol: h.symbol,
      amount: h.marketValue,
      currency: 'CNY',
      description: `持仓 ${h.quantity} 股/份 @¥${h.avgCost.toFixed(2)} → ¥${h.currentPrice.toFixed(2)} | 盈亏 ${h.profit >= 0 ? '+' : ''}¥${h.profit.toFixed(2)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLinked: true,
      _holding: h
    })
  }

  return merged
}
