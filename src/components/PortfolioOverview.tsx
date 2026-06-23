// 资产总览页
// 数据来源：assetStore（手动资产） + holdingStore（持仓联动）
// 特点：不依赖后端 /api/portfolio/summary，纯前端合并，确保一定能显示

import { Card, Statistic, Row, Col, Tag, Progress, Modal, Form, Input, DatePicker, Button, Empty, message, Popconfirm } from 'antd'
import {
  WalletOutlined,
  BankOutlined,
  CreditCardOutlined,
  AimOutlined,
  EditOutlined,
  DeleteOutlined,
  RiseOutlined,
  FallOutlined,
  AreaChartOutlined,
  StockOutlined
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useGoalStore } from '../stores/goalStore'
import { WealthCalculator } from '../utils/wealthCalculator'
import { UP_COLOR, DOWN_COLOR } from '../utils/financeColor'
import AssetPieChart from './AssetPieChart'
import AssetBarChart from './AssetBarChart'

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

  // ==================== 净资产目标计算 ====================
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
    ? '#52c41a'
    : goalProgressClamped >= 70
      ? '#1890ff'
      : goalProgressClamped >= 30
        ? '#faad14'
        : '#722ed1'

  // ==================== 目标 Modal 处理 ====================
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
      if (e?.errorFields) {
        // 表单校验失败
        return
      }
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
                value={portfolioSummary.totalMarketValue}
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
                  <RiseOutlined style={{ color: UP_COLOR }} /> :
                  <FallOutlined style={{ color: DOWN_COLOR }} />
                }
                suffix={isProfit ? '盈利' : '亏损'}
                precision={2}
                valueStyle={{ color: isProfit ? UP_COLOR : DOWN_COLOR, fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="收益率"
                value={portfolioSummary.totalProfitPercent}
                suffix="%"
                precision={2}
                prefix={isProfit ?
                  <RiseOutlined style={{ color: UP_COLOR }} /> :
                  <FallOutlined style={{ color: DOWN_COLOR }} />
                }
                valueStyle={{ color: isProfit ? UP_COLOR : DOWN_COLOR, fontSize: 18 }}
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

      {/* 原版：净资产 4 卡片（第 4 张改为「净资产目标」） */}
      <Row gutter={16} align="stretch">
        <Col span={6}>
          <Card
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 110,
              padding: '20px 24px'
            }}
          >
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
          <Card
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 110,
              padding: '20px 24px'
            }}
          >
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
          <Card
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 110,
              padding: '20px 24px'
            }}
          >
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
            title={
              <span>
                <AimOutlined style={{ color: progressColor, marginRight: 6 }} />
                净资产目标
                {goalReached && <Tag color="success" style={{ marginLeft: 6 }}>已达成</Tag>}
              </span>
            }
            extra={
              goal ? (
                <span style={{ fontSize: 12 }}>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={openGoalModal}
                    style={{ padding: '0 4px' }}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定清除目标？"
                    okText="清除"
                    cancelText="取消"
                    onConfirm={handleClearGoal}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      style={{ padding: '0 4px' }}
                    >
                      清除
                    </Button>
                  </Popconfirm>
                </span>
              ) : (
                <Button
                  type="primary"
                  size="small"
                  icon={<AimOutlined />}
                  onClick={openGoalModal}
                >
                  设置目标
                </Button>
              )
            }
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 110,
              padding: '16px 20px'
            }}
          >
            {goal ? (
              <div style={{ width: '100%' }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: progressColor }}>
                    {currentNetWorth.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ color: '#999', margin: '0 6px' }}>/</span>
                  <span style={{ color: '#666' }}>
                    {goalAmount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <Progress
                  percent={goalProgressClamped}
                  strokeColor={progressColor}
                  showInfo={false}
                  size="small"
                  strokeWidth={6}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#666',
                  marginTop: 6
                }}>
                  <span style={{ color: progressColor, fontWeight: 500 }}>
                    {goalProgressClamped.toFixed(2)}%
                  </span>
                  {goalReached ? (
                    <span style={{ color: UP_COLOR }}>
                      已超额 {Math.abs(goalRemaining).toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 元
                    </span>
                  ) : (
                    <span>还差 {goalRemaining.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 元</span>
                  )}
                </div>
                {daysLeft !== null && (
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    {daysLeft > 0
                      ? <>距 <span style={{ color: '#666' }}>{goal.targetDate}</span> 还有 <span style={{ color: progressColor, fontWeight: 500 }}>{daysLeft}</span> 天</>
                      : daysLeft === 0
                        ? <>今天就是目标日 🎯</>
                        : <>已过目标日 {Math.abs(daysLeft)} 天</>
                    }
                  </div>
                )}
                {goal.note && (
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    📝 {goal.note}
                  </div>
                )}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#999', fontSize: 12 }}>
                    尚未设置目标
                  </span>
                }
                style={{ margin: '8px 0' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 设置 / 编辑目标 Modal */}
      <Modal
        title={
          <span>
            <AimOutlined style={{ marginRight: 6, color: '#722ed1' }} />
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
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ amount: undefined, targetDate: null, note: '' }}
        >
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
            />
          </Form.Item>

          <Form.Item
            label="目标日期（可选）"
            name="targetDate"
            extra="不填则不显示剩余天数"
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
              placeholder="选择日期"
              allowClear
            />
          </Form.Item>

          <Form.Item
            label="备注（可选）"
            name="note"
          >
            <Input
              placeholder="例如：3年2000万"
              maxLength={50}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

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
