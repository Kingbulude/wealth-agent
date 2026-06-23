// 资产管理页（恢复原版逻辑）
// 数据来源：assetStore（手动录入的资产：现金、房产、负债等）
// 联动：投资资产下的 stock/fund 自动从持仓管理拉取实时市值

import { useState, useEffect, useMemo } from 'react'
import { Table, Button, Space, Tag, Popconfirm, message, Select, Card, Alert, Tooltip, Statistic, Row, Col, Empty } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, StockOutlined, FundOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons'
import {
  Asset,
  AssetCategory,
  ASSET_CATEGORY_META,
  ASSET_SUBTYPE_META
} from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { usePortfolioStore, HoldingDetail } from '../stores/portfolioStore'
import AddAssetModal from './AddAssetModal'

const { Option } = Select

export default function AssetList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editData, setEditData] = useState<Asset | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const { loadAssets, deleteAsset, getAssetsByCategory, customTypes, assets } = useAssetStore()
  const { data: portfolioData, loadPortfolio, refreshing, lastFetchedAt } = usePortfolioStore()

  useEffect(() => {
    loadAssets()
    loadPortfolio()
  }, [])

  // 计算持仓联动摘要
  const linkedHoldings = useMemo(() => {
    if (!portfolioData?.holdings) return []
    return portfolioData.holdings
  }, [portfolioData])

  const linkedTotalValue = linkedHoldings.reduce((s, h) => s + (h.marketValue || 0), 0)
  const linkedTotalProfit = linkedHoldings.reduce((s, h) => s + (h.profit || 0), 0)
  const linkedTotalCost = linkedHoldings.reduce((s, h) => s + (h.cost || 0), 0)
  const linkedProfitPercent = linkedTotalCost > 0 ? (linkedTotalProfit / linkedTotalCost) * 100 : 0

  // 把投资资产分类下且 symbol 与持仓匹配的标记为联动
  const linkedSymbols = new Set(linkedHoldings.map(h => h.symbol))
  const holdingsBySymbol = new Map(linkedHoldings.map(h => [h.symbol, h]))

  // 合并数据：投资资产中 stock/fund 类型，自动用持仓市值覆盖
  const mergedAssets = useMemo(() => {
    const merged = assets.map(a => {
      if (a.category === 'investment' && (a.type === 'stock' || a.type === 'fund')) {
        const holding = holdingsBySymbol.get(a.symbol)
        if (holding) {
          return {
            ...a,
            amount: holding.marketValue,
            description: `🔗 联动持仓：${holding.quantity}股/份 @¥${holding.avgCost.toFixed(2)} → ¥${holding.currentPrice.toFixed(2)} | 盈亏 ${holding.profit >= 0 ? '+' : ''}¥${holding.profit.toFixed(2)}`,
            isLinked: true
          }
        }
      }
      return a
    })

    // 持仓中有但资产里没的，添加虚拟条目
    for (const h of linkedHoldings) {
      const exists = merged.find(a => a.category === 'investment' && a.type === h.type && a.symbol === h.symbol)
      if (!exists) {
        merged.push({
          id: `linked-${h.id}`,
          userId: '',
          category: 'investment',
          type: h.type,
          name: `${h.name}（联动）`,
          symbol: h.symbol,
          amount: h.marketValue,
          currency: 'CNY',
          description: `🔗 联动持仓：${h.quantity}股/份 @¥${h.avgCost.toFixed(2)} → ¥${h.currentPrice.toFixed(2)} | 盈亏 ${h.profit >= 0 ? '+' : ''}¥${h.profit.toFixed(2)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isLinked: true
        } as any)
      }
    }

    return merged
  }, [assets, linkedHoldings])

  const filteredAssets = getAssetsByCategory(filterCategory).map(a => {
    if (a.category === 'investment' && (a.type === 'stock' || a.type === 'fund')) {
      const holding = holdingsBySymbol.get(a.symbol)
      if (holding) {
        return { ...a, amount: holding.marketValue, isLinked: true }
      }
    }
    return a
  })

  const handleEdit = (record: Asset) => {
    if ((record as any).isLinked) {
      message.info('这是持仓联动数据，请前往「持仓管理」修改')
      return
    }
    setEditData(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    if (id.startsWith('linked-')) {
      message.info('联动数据请前往「持仓管理」删除')
      return
    }
    await deleteAsset(id)
    message.success('删除成功')
  }

  const handleAdd = () => {
    setEditData(null)
    setModalVisible(true)
  }

  const handleModalClose = () => {
    setModalVisible(false)
    setEditData(null)
  }

  const handleAddHolding = () => {
    // 跳转到持仓管理 Tab
    const event = new CustomEvent('switch-tab', { detail: { key: 'holdings' } })
    window.dispatchEvent(event)
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
      {/* 持仓联动摘要卡（实时） */}
      {linkedHoldings.length > 0 && (
        <Card
          size="small"
          title={
            <span>
              <LinkOutlined style={{ color: '#1890ff', marginRight: 8 }} />
              🔗 持仓联动（投资资产中的股票/基金）
              <Tag color="cyan" style={{ marginLeft: 8 }}>实时同步</Tag>
              {refreshing && <span style={{ color: '#faad14', fontSize: 12, marginLeft: 8 }}>刷新中…</span>}
              {!refreshing && lastFetchedAt && (
                <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                  {new Date(lastFetchedAt).toLocaleTimeString('zh-CN', { hour12: false })} 更新
                </span>
              )}
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
                value={linkedTotalValue}
                prefix={<StockOutlined style={{ color: '#1890ff' }} />}
                suffix="元"
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="联动持仓成本"
                value={linkedTotalCost}
                prefix={<StockOutlined style={{ color: '#999' }} />}
                suffix="元"
                precision={2}
                valueStyle={{ color: '#999', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="浮动盈亏"
                value={Math.abs(linkedTotalProfit)}
                prefix={linkedTotalProfit >= 0 ?
                  <RiseOutlined style={{ color: '#52c41a' }} /> :
                  <FallOutlined style={{ color: '#f5222d' }} />
                }
                suffix={linkedTotalProfit >= 0 ? '盈利' : '亏损'}
                precision={2}
                valueStyle={{ color: linkedTotalProfit >= 0 ? '#52c41a' : '#f5222d', fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="收益率"
                value={linkedProfitPercent}
                suffix="%"
                precision={2}
                prefix={linkedProfitPercent >= 0 ?
                  <RiseOutlined style={{ color: '#52c41a' }} /> :
                  <FallOutlined style={{ color: '#f5222d' }} />
                }
                valueStyle={{ color: linkedProfitPercent >= 0 ? '#52c41a' : '#f5222d', fontSize: 18 }}
              />
            </Col>
          </Row>

          {/* 联动明细列表 */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8e8e8' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
              📋 联动明细（{linkedHoldings.length} 条，编辑/删除请到持仓管理）
            </div>
            <Row gutter={[8, 8]}>
              {linkedHoldings.map(h => {
                const isProfit = h.profit >= 0
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
                        <strong>¥{h.marketValue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{
                        color: isProfit ? '#52c41a' : '#f5222d',
                        fontWeight: 500
                      }}>
                        {isProfit ? '+' : ''}¥{h.profit.toFixed(2)} ({isProfit ? '+' : ''}{h.profitPercent.toFixed(2)}%)
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
        {filteredAssets.length === 0 ? (
          <Empty description="暂无资产，点击上方按钮添加" />
        ) : (
          <Table
            columns={columns}
            dataSource={mergedAssets.filter(a => filterCategory === 'all' || a.category === filterCategory)}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: '暂无资产，点击上方按钮添加' }}
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
