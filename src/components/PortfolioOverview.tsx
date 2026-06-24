// 资产总览页
// 设计风格：Modern Wealth Terminal
// 数据来源：assetStore（手动资产） + holdingStore（持仓联动）
// 特点：不依赖后端 /api/portfolio/summary，纯前端合并，确保一定能显示

import { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Input, DatePicker, Button, Empty, message, Popconfirm } from 'antd'
import {
  AimOutlined,
  EditOutlined,
  DeleteOutlined,
  StockOutlined,
  RiseOutlined,
  FallOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  WalletOutlined,
  BankOutlined,
  CreditCardOutlined,
  AreaChartOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useGoalStore } from '../stores/goalStore'
import { WealthCalculator } from '../utils/wealthCalculator'
import { UP_COLOR, DOWN_COLOR } from '../utils/financeColor'
import AssetPieChart from './AssetPieChart'
import AssetBarChart from './AssetBarChart'

// Format helpers
const fmtMoney = (n: number, fractionDigits = 2) => {
  if (!isFinite(n)) return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
}
const fmtInt = (n: number) => Math.round(n).toLocaleString('zh-CN')

export default function PortfolioOverview() {
  const { assets, loadAssets } = useAssetStore()
  const { holdings, loadHoldings, refreshing } = useHoldingStore()
  const { data: portfolioData, loadPortfolio } = usePortfolioStore()
  const { goal, loadGoal, setGoal, clearGoal, saving } = useGoalStore()

  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadAssets()
    loadPortfolio()
    loadGoal()
  }, [])

  // ========== 合并持仓市值到投资资产分类 ==========
  const mergedAssets = useMemo(() => {
    const merged = [...assets]
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
    for (const h of holdings) {
      if (!h.symbol) continue
      const exists = merged.find(a =>
        a.category === 'investment' && a.type === h.type && a.symbol === h.symbol
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

  const summary = useMemo(() => WealthCalculator.calculateSummary(mergedAssets), [mergedAssets])

  const hasHoldings = holdings.length > 0
  const portfolioSummary = portfolioData?.summary ?? null
  const isProfit = (portfolioSummary?.totalProfit ?? 0) >= 0
  const dataReady = portfolioData !== null

  // ========== 目标计算 ==========
  const currentNetWorth = summary.totalNetWorth
  const goalAmount = goal?.amount ?? 0
  const goalProgress = goalAmount > 0 ? Math.min(100, (currentNetWorth / goalAmount) * 100) : 0
  const goalProgressClamped = Math.max(0, Math.min(100, goalProgress))
  const goalRemaining = Math.max(0, goalAmount - currentNetWorth)
  const goalReached = goalAmount > 0 && currentNetWorth >= goalAmount
  const daysLeft = goal?.targetDate
    ? dayjs(goal.targetDate).startOf('day').diff(dayjs().startOf('day'), 'day')
    : null

  const progressColor = goalReached
    ? '#4a9b7e'
    : goalProgressClamped >= 70
      ? '#3a6fc7'
      : goalProgressClamped >= 30
        ? '#c98a3a'
        : '#8a5cc9'

  const openGoalModal = () => {
    if (goal) {
      form.setFieldsValue({
        amount: goal.amount,
        targetDate: goal.targetDate ? dayjs(goal.targetDate) : null,
        note: goal.note || ''
      })
    } else {
      form.resetFields()
    }
    setGoalModalOpen(true)
  }

  const submitGoal = async () => {
    try {
      const values = await form.validateFields()
      const amount = Number(values.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        message.error('请输入有效的目标金额')
        return
      }
      const targetDate: Dayjs | null = values.targetDate
      await setGoal({
        amount,
        targetDate: targetDate ? targetDate.format('YYYY-MM-DD') : undefined,
        note: values.note?.trim() || undefined
      })
      message.success('目标已保存')
      setGoalModalOpen(false)
    } catch (e: any) {
      if (e?.errorFields) return
      console.error(e)
      message.error(e?.message || '保存失败')
    }
  }

  const handleClearGoal = async () => {
    try {
      await clearGoal()
      message.success('已清除目标')
    } catch (e: any) {
      message.error(e?.message || '清除失败')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ============================================================
          Section 1 — Page Title
          ============================================================ */}
      <div className="section-header fade-in">
        <div>
          <div className="section-eyebrow">Portfolio Overview</div>
          <h1 className="section-title">资产总览</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {refreshing && (
            <span className="chip muted">
              <span className="dot" style={{ background: '#c9a76a' }} />
              行情同步中…
            </span>
          )}
          {!refreshing && dataReady && (
            <span className="chip gold">
              <span className="dot" />
              数据已同步
            </span>
          )}
        </div>
      </div>

      {/* ============================================================
          Section 2 — Hero KPI Grid (4 cards, 净资产/总资产/总负债/目标)
          ============================================================ */}
      <div className="kpi-grid fade-in-1">
        {/* 净资产（Hero — 深色卡） */}
        <div className="kpi-card kpi-hero" style={{ '--accent': 'var(--brand-500)' } as React.CSSProperties}>
          <div className="kpi-head">
            <div className="kpi-label">
              <span className="kpi-icon"><WalletOutlined /></span>
              净资产
            </div>
            <span className="chip ink" style={{ background: 'rgba(201, 167, 106, 0.18)' }}>
              NET WORTH
            </span>
          </div>
          <div className="kpi-value">
            <span className="currency">¥</span>
            {fmtMoney(summary.totalNetWorth)}
            <span className="unit">元</span>
          </div>
          <div className="kpi-foot">
            <span>实时 · 含持仓市值与负债</span>
          </div>
        </div>

        {/* 总资产 */}
        <div className="kpi-card" style={{ '--accent': 'var(--cat-cash)' } as React.CSSProperties}>
          <div className="kpi-head">
            <div className="kpi-label">
              <span className="kpi-icon" style={{ background: 'rgba(74,155,126,0.12)', color: '#4a9b7e' }}>
                <BankOutlined />
              </span>
              总资产
            </div>
          </div>
          <div className="kpi-value">
            <span className="currency">¥</span>
            {fmtMoney(summary.totalAssets)}
            <span className="unit">元</span>
          </div>
          <div className="kpi-foot">
            现金、投资、房产、贵金属
          </div>
        </div>

        {/* 总负债 */}
        <div className="kpi-card" style={{ '--accent': 'var(--cat-debt)' } as React.CSSProperties}>
          <div className="kpi-head">
            <div className="kpi-label">
              <span className="kpi-icon" style={{ background: 'rgba(214,59,59,0.10)', color: '#d63b3b' }}>
                <CreditCardOutlined />
              </span>
              总负债
            </div>
          </div>
          <div className="kpi-value" style={{ color: summary.totalLiabilities > 0 ? '#d63b3b' : 'var(--text-primary)' }}>
            <span className="currency">¥</span>
            {fmtMoney(summary.totalLiabilities)}
            <span className="unit">元</span>
          </div>
          <div className="kpi-foot">
            房贷、车贷、信用卡等
          </div>
        </div>

        {/* 净资产目标 */}
        <div className="kpi-card" style={{ '--accent': progressColor } as React.CSSProperties}>
          <div className="kpi-head">
            <div className="kpi-label">
              <span
                className="kpi-icon"
                style={{ background: `${progressColor}1f`, color: progressColor }}
              >
                <AimOutlined />
              </span>
              净资产目标
            </div>
            {goalReached && (
              <span className="chip" style={{ background: 'rgba(74,155,126,0.12)', color: '#4a9b7e' }}>
                已达成
              </span>
            )}
          </div>

          {goal ? (
            <>
              <div className="kpi-value" style={{ color: progressColor }}>
                <span className="currency" style={{ color: progressColor }}>¥</span>
                {fmtInt(currentNetWorth)}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10
              }}>
                <span className="num">目标 ¥{fmtInt(goalAmount)}</span>
                <span style={{ color: progressColor, fontWeight: 600 }}>
                  {goalProgressClamped.toFixed(2)}%
                </span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${goalReached ? 'success' : ''}`}
                  style={{ width: `${goalProgressClamped}%` }}
                />
              </div>
              <div className="kpi-foot" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                {goalReached ? (
                  <span style={{ color: '#4a9b7e' }}>
                    超额 +¥{fmtInt(Math.abs(goalRemaining))}
                  </span>
                ) : (
                  <span>还差 ¥{fmtInt(goalRemaining)}</span>
                )}
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className="num">{daysLeft} 天</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="kpi-value" style={{ color: 'var(--text-tertiary)' }}>—</div>
              <Button
                type="primary"
                icon={<AimOutlined />}
                onClick={openGoalModal}
                style={{
                  width: '100%',
                  background: 'var(--ink-950)',
                  borderColor: 'var(--ink-950)',
                  height: 36,
                  fontWeight: 600
                }}
              >
                设置目标
              </Button>
            </>
          )}

          {goal && (
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={openGoalModal}
                style={{ flex: 1, color: 'var(--text-secondary)' }}
              >
                编辑
              </Button>
              <Popconfirm title="确定清除目标？" onConfirm={handleClearGoal} okText="清除" cancelText="取消">
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  style={{ flex: 1 }}
                >
                  清除
                </Button>
              </Popconfirm>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          Section 3 — Holdings Snapshot (实时持仓)
          ============================================================ */}
      {hasHoldings && dataReady && portfolioSummary && (
        <div className="panel fade-in-2">
          <div className="panel-head">
            <div>
              <div className="panel-title">
                <span className="accent-bar" />
                持仓联动
                <span className="chip ink" style={{ marginLeft: 6 }}>
                  <span className="live-dot" />
                  REAL-TIME
                </span>
              </div>
              <div className="panel-sub">来自「持仓管理」标签的实时市值与盈亏</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="chip muted">
                <StockOutlined style={{ fontSize: 11 }} />
                {holdings.length} 个标的
              </span>
            </div>
          </div>

          <div className="snapshot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {/* 总市值 */}
            <div style={{
              padding: '20px 22px',
              background: 'linear-gradient(135deg, #f6f8fc 0%, #ffffff 100%)',
              border: '1px solid var(--card-border)',
              borderRadius: 12,
              position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: 'rgba(58,111,199,0.12)', color: '#3a6fc7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <AreaChartOutlined />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                  持仓总市值
                </span>
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: '#3a6fc7' }}>
                ¥{fmtMoney(portfolioSummary.totalMarketValue)}
              </div>
            </div>

            {/* 浮动盈亏 */}
            <div style={{
              padding: '20px 22px',
              background: 'linear-gradient(135deg, #f6f8fc 0%, #ffffff 100%)',
              border: '1px solid var(--card-border)',
              borderRadius: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: isProfit ? 'var(--up-soft)' : 'var(--down-soft)',
                  color: isProfit ? 'var(--up)' : 'var(--down)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {isProfit ? <RiseOutlined /> : <FallOutlined />}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                  浮动盈亏
                </span>
              </div>
              <div className="num" style={{
                fontSize: 22, fontWeight: 700,
                color: isProfit ? 'var(--up)' : 'var(--down)'
              }}>
                {isProfit ? '+' : '-'}¥{fmtMoney(Math.abs(portfolioSummary.totalProfit))}
              </div>
            </div>

            {/* 收益率 */}
            <div style={{
              padding: '20px 22px',
              background: 'linear-gradient(135deg, #f6f8fc 0%, #ffffff 100%)',
              border: '1px solid var(--card-border)',
              borderRadius: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: isProfit ? 'var(--up-soft)' : 'var(--down-soft)',
                  color: isProfit ? 'var(--up)' : 'var(--down)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {isProfit ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                  累计收益率
                </span>
              </div>
              <div className="num" style={{
                fontSize: 22, fontWeight: 700,
                color: isProfit ? 'var(--up)' : 'var(--down)'
              }}>
                {isProfit ? '+' : ''}{portfolioSummary.totalProfitPercent.toFixed(2)}%
              </div>
            </div>

            {/* 持仓数量 */}
            <div style={{
              padding: '20px 22px',
              background: 'linear-gradient(135deg, #f6f8fc 0%, #ffffff 100%)',
              border: '1px solid var(--card-border)',
              borderRadius: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: 'rgba(138,92,201,0.12)', color: '#8a5cc9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <StockOutlined />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                  持仓分布
                </span>
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: '#8a5cc9' }}>
                {holdings.length}<span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 6 }}>只</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                <span style={{ color: '#3a6fc7' }}>股 {portfolioSummary.stockCount}</span>
                <span style={{ margin: '0 6px', color: 'var(--card-border)' }}>·</span>
                <span style={{ color: '#8a5cc9' }}>基 {portfolioSummary.fundCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          Section 4 — Charts (Pie + Bar)
          ============================================================ */}
      <div className="chart-row fade-in-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">
                <span className="accent-bar" />
                资产分布
              </div>
              <div className="panel-sub">按一级分类占比</div>
            </div>
            <span className="chip gold">已合并持仓市值</span>
          </div>
          <div className="panel-body">
            <AssetPieChart assets={mergedAssets} height={340} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">
                <span className="accent-bar" />
                资产构成
              </div>
              <div className="panel-sub">各大类金额对比</div>
            </div>
            <span className="chip gold">已合并持仓市值</span>
          </div>
          <div className="panel-body">
            <AssetBarChart assets={mergedAssets} height={340} />
          </div>
        </div>
      </div>

      {/* ============================================================
          Goal Modal
          ============================================================ */}
      <Modal
        title={
          <span>
            <AimOutlined style={{ marginRight: 8, color: '#c9a76a' }} />
            {goal ? '编辑净资产目标' : '设置净资产目标'}
          </span>
        }
        open={goalModalOpen}
        onCancel={() => setGoalModalOpen(false)}
        onOk={submitGoal}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={{ amount: undefined, targetDate: null, note: '' }}>
          <Form.Item
            label="目标金额（元）"
            name="amount"
            rules={[
              { required: true, message: '请输入目标金额' },
              {
                validator: (_, v) =>
                  Number(v) > 0 ? Promise.resolve() : Promise.reject(new Error('目标金额必须大于 0'))
              }
            ]}
          >
            <Input
              type="number"
              placeholder="例如：20000000"
              min={1}
              step={10000}
              prefix="¥"
              suffix="元"
              size="large"
            />
          </Form.Item>

          <Form.Item label="目标日期（可选）" name="targetDate" extra="不填则不显示剩余天数">
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
              placeholder="选择日期"
              allowClear
              size="large"
            />
          </Form.Item>

          <Form.Item label="备注（可选）" name="note">
            <Input placeholder="例如：3年2000万" maxLength={50} showCount size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
