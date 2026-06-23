// 资产管理页
// 数据来源：assetStore（手动录入的资产：现金、房产、负债等）
// 联动：投资资产下的股票/基金自动从持仓管理（holdingStore）拉取实时市值
// 特点：不依赖后端 /api/portfolio/summary，纯前端计算，确保一定能显示

import { useState, useEffect, useMemo } from 'react'
import { Table, Button, Space, Tag, Popconfirm, message, Select, Card, Tooltip, Statistic, Row, Col, Empty } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, StockOutlined, FundOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons'
import {
  Asset,
  AssetCategory,
  ASSET_CATEGORY_META,
  ASSET_SUBTYPE_META
} from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { UP_COLOR, DOWN_COLOR } from '../utils/financeColor'
import AddAssetModal from './AddAssetModal'

const { Option } = Select

export default function AssetList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editData, setEditData] = useState<Asset | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const { loadAssets, deleteAsset, customTypes, assets } = useAssetStore()
  const { holdings, loadHoldings, refreshPrices, refreshing } = useHoldingStore()

  useEffect(() => {
    loadAssets()
    loadHoldings()
  }, [])

  // ========== 联动计算：把持仓合并到投资资产分类 ==========
  const mergedAssets = useMemo(() => {
    const merged = [...assets]

    // 1) 替换现有同 symbol 的投资资产金额
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i]
      if (a.category === 'investment' && (a.type === 'stock' || a.type === 'fund') && a.symbol) {
        const holding = holdings.find(h => h.symbol === a.symbol && h.type === a.type)
        if (holding && holding.currentPrice > 0) {
          const marketValue = holding.currentPrice * holding.quantity
          merged[i] = {
            ...a,
            amount: marketValue,
            name: `${holding.name}（联动）`,
            description: `🔗 持仓 ${holding.quantity}${holding.type === 'stock' ? '股' : '份'} @¥${holding.avgCost.toFixed(2)} → ¥${holding.currentPrice.toFixed(2)}`,
            isLinked: true
          } as any
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
          description: `🔗 持仓 ${h.quantity}${h.type === 'stock' ? '股' : '份'} @¥${h.avgCost.toFixed(2)} → ¥${(h.currentPrice || h.avgCost).toFixed(2)}`,
          createdAt: h.lastUpdated || new Date().toISOString(),
          updatedAt: h.lastUpdated || new Date().toISOString(),
          isLinked: true
        } as any)
      }
    }

    return merged
  }, [assets, holdings])

  // 筛选后的资产
  const displayAssets = useMemo(() => {
    if (filterCategory === 'all') return mergedAssets
    return mergedAssets.filter(a => a.category === filterCategory)
  }, [mergedAssets, filterCategory])

  // 联动汇总数据
  const linkedSummary = useMemo(() => {
    const linkedHoldings = holdings
    const totalValue = linkedHoldings.reduce((s, h) => s + (h.currentPrice || h.avgCost) * h.quantity, 0)
    const totalCost = linkedHoldings.reduce((s, h) => s + h.avgCost * h.quantity, 0)
    const totalProfit = totalValue - totalCost
    const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
    const stockCount = holdings.filter(h => h.type === 'stock').length
    const fundCount = holdings.filter(h => h.type === 'fund').length
    return { totalValue, totalCost, totalProfit, profitPercent, count: holdings.length, stockCount, fundCount }
  }, [holdings])

  const handleEdit = (record: Asset) => {
    if ((record as any).isLinked) {
      message.info('这是持仓联动数据，请前往「持仓管理」修改')
      // 切换到持仓管理 Tab
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: { key: 'holdings' } }))
      return
    }
    setEditData(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    if (id.startsWith('linked-')) {
      message.info('联动数据请前往「持仓管理」删除')
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: { key: 'holdings' } }))
      return
    }
    await deleteAsset(id)
    message.success('删除成功')
  }

  const handleAdd = () => {
    setEditData(null)
    setModalVisible(true)
  }

  const handleAddHolding = () => {
    window.dispatchEvent(new CustomEvent('switch-tab', { detail: { key: 'holdings' } }))
  }

  const handleModalClose = () => {
    setModalVisible(false)
    setEditData(null)
  }

  const getTypeLabel = (asset: Asset) => {
    const standardMeta = ASSET_SUBTYPE_META[asset.type]
    if (standardMeta) {
      return {
        icon: standardMeta.icon,
        label: standardMeta.label,
        color: ASSET_CATEGORY_META[standardMeta.category]?.color || '#666'
      }
    }
    const customMeta = customTypes.find(ct => ct.type === asset.type)
    if (customMeta) {
      return {
        icon: '✨',
        label: customMeta.name,
        color: ASSET_CATEGORY_META[customMeta.category]?.color || '#666'
      }
    }
    return { icon: '📦', label: asset.type, color: '#666' }
  }

  const columns = [
    {
      title: '大类',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (category: AssetCategory) => {
        const meta = ASSET_CATEGORY_META[category]
        if (!meta) return <Tag>{category || '未分类'}</Tag>
        return <Tag color={meta.color}>{meta.icon} {meta.label.split(' ')[1]}</Tag>
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (_: any, record: Asset) => {
        const typeInfo = getTypeLabel(record)
        const isLinked = (record as any).isLinked
        return (
          <Space>
            <Tag>{typeInfo.icon} {typeInfo.label}</Tag>
            {isLinked && <Tag color="cyan" icon={<LinkOutlined />}>联动</Tag>}
          </Space>
        )
      }
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (name: string, record: Asset) => (
        <Space>
          <strong>{name}</strong>
          {(record as any).symbol && <Tag color="default" style={{ fontSize: 11 }}>{(record as any).symbol}</Tag>}
        </Space>
      )
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (amount: number, record: Asset) => {
        const isDebt = record.category === 'debt'
        const isLinked = (record as any).isLinked
        return (
          <Space>
            <span style={{
              color: isDebt ? '#f5222d' : isLinked ? '#1890ff' : '#52c41a',
              fontWeight: isLinked ? 600 : 400
            }}>
              {isDebt ? '-' : '+'}¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </span>
            {isLinked && <Tooltip title="此金额来自持仓管理的实时市值"><LinkOutlined style={{ color: '#1890ff' }} /></Tooltip>}
          </Space>
        )
      }
    },
    {
      title: '货币',
      dataIndex: 'currency',
      key: 'currency',
      width: 100,
      render: (currency: string) => {
        const currencyMap: Record<string, string> = {
          CNY: '🇨🇳 CNY', USD: '🇺🇸 USD', EUR: '🇪🇺 EUR', HKD: '🇭🇰 HKD', JPY: '🇯🇵 JPY'
        }
        return currencyMap[currency] || currency
      }
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => desc ? <span style={{ fontSize: 12, color: '#666' }}>{desc}</span> : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'center' as const,
      render: (_: any, record: Asset) => {
        const isLinked = (record as any).isLinked
        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {!isLinked && (
              <>
                <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small">
                  编辑
                </Button>
                <Popconfirm
                  title="确定删除这条资产吗？"
                  onConfirm={() => handleDelete(record.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="text" danger icon={<DeleteOutlined />} size="small">
                    删除
                  </Button>
                </Popconfirm>
              </>
            )}
            {isLinked && (
              <Tooltip title="联动数据请前往持仓管理修改">
                <Button type="text" size="small" onClick={handleAddHolding}>
                  前往持仓
                </Button>
              </Tooltip>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div>
      {/* 持仓联动摘要卡 */}
      {holdings.length > 0 && (
        <Card
          size="small"
          title={
            <span>
              <LinkOutlined style={{ color: '#1890ff', marginRight: 8 }} />
              🔗 持仓联动（投资资产中的股票/基金）
              <Tag color="cyan" style={{ marginLeft: 8 }}>实时同步</Tag>
              {refreshing && <span style={{ color: '#faad14', fontSize: 12, marginLeft: 8 }}>刷新中…</span>}
            </span>
          }
          extra={
            <Button type="link" size="small" onClick={handleAddHolding}>
              + 添加持仓
            </Button>
          }
          style={{ marginBottom: 16, borderLeft: '4px solid #1890ff' }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="联动持仓市值"
                value={linkedSummary.totalValue}
                prefix={<StockOutlined style={{ color: '#1890ff' }} />}
                suffix="元"
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="联动持仓成本"
                value={linkedSummary.totalCost}
                prefix={<StockOutlined style={{ color: '#999' }} />}
                suffix="元"
                precision={2}
                valueStyle={{ color: '#999', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="浮动盈亏"
                value={Math.abs(linkedSummary.totalProfit)}
                prefix={linkedSummary.totalProfit >= 0 ?
                  <RiseOutlined style={{ color: UP_COLOR }} /> :
                  <FallOutlined style={{ color: DOWN_COLOR }} />
                }
                suffix={linkedSummary.totalProfit >= 0 ? '盈利' : '亏损'}
                precision={2}
                valueStyle={{ color: linkedSummary.totalProfit >= 0 ? UP_COLOR : DOWN_COLOR, fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="收益率"
                value={linkedSummary.profitPercent}
                suffix="%"
                precision={2}
                prefix={linkedSummary.profitPercent >= 0 ?
                  <RiseOutlined style={{ color: UP_COLOR }} /> :
                  <FallOutlined style={{ color: DOWN_COLOR }} />
                }
                valueStyle={{ color: linkedSummary.profitPercent >= 0 ? UP_COLOR : DOWN_COLOR, fontSize: 18 }}
              />
            </Col>
          </Row>

          {/* 联动明细 */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8e8e8' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
              📋 联动明细（{holdings.length} 条，编辑/删除请到持仓管理）
            </div>
            <Row gutter={[8, 8]}>
              {holdings.map(h => {
                const isProfit = ((h.currentPrice || h.avgCost) - h.avgCost) * h.quantity >= 0
                const profit = ((h.currentPrice || h.avgCost) - h.avgCost) * h.quantity
                const profitPercent = h.avgCost > 0 ? (((h.currentPrice || h.avgCost) - h.avgCost) / h.avgCost) * 100 : 0
                return (
                  <Col key={h.id} span={6}>
                    <div style={{
                      background: '#fafafa',
                      border: '1px solid #e8e8e8',
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 12
                    }}>
                      <div style={{ fontWeight: 600, color: '#1890ff' }}>
                        {h.type === 'stock' ? <StockOutlined /> : <FundOutlined />} {h.name}
                      </div>
                      <div style={{ color: '#999', fontSize: 11 }}>
                        {h.symbol} · {h.quantity}{h.type === 'stock' ? '股' : '份'}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{ color: '#666' }}>市值 </span>
                        <strong>¥{((h.currentPrice || h.avgCost) * h.quantity).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{
                        color: isProfit ? UP_COLOR : DOWN_COLOR,
                        fontWeight: 500
                      }}>
                        {isProfit ? '+' : ''}¥{profit.toFixed(2)} ({isProfit ? '+' : ''}{profitPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </Col>
                )
              })}
            </Row>
          </div>
        </Card>
      )}

      <Card
        title="📋 我的资产"
        extra={
          <Space>
            <Select
              value={filterCategory}
              onChange={setFilterCategory}
              style={{ width: 160 }}
            >
              <Option value="all">全部大类</Option>
              {Object.entries(ASSET_CATEGORY_META).map(([key, meta]) => (
                <Option key={key} value={key}>
                  {meta.icon} {meta.label.split(' ')[1]}
                </Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              添加资产
            </Button>
          </Space>
        }
      >
        {displayAssets.length === 0 ? (
          <Empty description="暂无资产，点击上方按钮添加" />
        ) : (
          <Table
            columns={columns}
            dataSource={displayAssets}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 900 }}
          />
        )}
      </Card>

      <AddAssetModal
        visible={modalVisible}
        onClose={handleModalClose}
        editData={editData}
      />
    </div>
  )
}
