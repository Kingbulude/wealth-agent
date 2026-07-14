// 资产管理页
// 设计风格：Modern Wealth Terminal
// 特点：资产总览卡 + 类别汇总 + 列表展示 + 添加/编辑/删除

import { useEffect, useMemo, useState } from 'react'
import {
  Modal, Form, Input, InputNumber, Select, Button, message, Popconfirm,
  Table, Empty, Tooltip
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  WalletOutlined, BankOutlined, HomeOutlined, GoldOutlined,
  DollarOutlined, CreditCardOutlined
} from '@ant-design/icons'
import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { WealthCalculator } from '../utils/wealthCalculator'
import { CompactNumber } from '../utils/compactNumber'
import {
  ASSET_CATEGORY_META,
  ASSET_SUBTYPE_META,
  CURRENCY_OPTIONS,
  getSubtypesByCategory,
  AssetCategory,
  AssetSubType
} from '../types/asset'
import type { Asset } from '../types/asset'

const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  cash: <WalletOutlined />,
  investment: <BankOutlined />,
  real_estate: <HomeOutlined />,
  precious: <GoldOutlined />,
  currency: <DollarOutlined />,
  debt: <CreditCardOutlined />
}

const CATEGORY_COLORS: Record<string, string> = {
  cash: '#4a9b7e',
  investment: '#3a6fc7',
  real_estate: '#c98a3a',
  precious: '#8a5cc9',
  currency: '#2c9bb8',
  debt: '#d63b3b'
}

export default function AssetList() {
  const { assets, loadAssets, addAsset, updateAsset, deleteAsset, customTypes, addCustomType } = useAssetStore()
  const { holdings, loadHoldings } = useHoldingStore()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // 自定义类型弹窗
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState<AssetCategory>('cash')

  useEffect(() => {
    loadAssets()
    loadHoldings()
  }, [])

  // 合并持仓市值（与 PortfolioOverview 一致）
  const mergedAssets = useMemo(() => {
    const merged = [...assets]
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i]
      if (a.category === 'investment' && (a.type === 'stock' || a.type === 'fund') && a.symbol) {
        const h = holdings.find(x => x.symbol === a.symbol && x.type === a.type)
        if (h && h.currentPrice > 0) {
          merged[i] = { ...a, amount: h.currentPrice * h.quantity, name: `${a.name}（联动）`, isLinked: true }
        }
      }
    }
    for (const h of holdings) {
      if (!h.symbol) continue
      const exists = merged.find(a =>
        a.category === 'investment' && a.type === h.type && a.symbol === h.symbol
      )
      if (!exists) {
        merged.push({
          id: `linked-${h.id}`,
          userId: '',
          category: 'investment',
          type: h.type,
          name: `${h.name}（联动）`,
          symbol: h.symbol,
          amount: (h.currentPrice || h.avgCost) * h.quantity,
          currency: 'CNY',
          description: '🔗 联动持仓',
          createdAt: h.lastUpdated || new Date().toISOString(),
          updatedAt: h.lastUpdated || new Date().toISOString(),
          isLinked: true
        })
      }
    }
    return merged
  }, [assets, holdings])

  // 按类别汇总
  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {}
    mergedAssets.forEach(a => {
      const cat = a.category
      const amt = WealthCalculator.convertToCNY(a.amount, a.currency)
      if (cat === 'debt') {
        map[cat] = (map[cat] || 0) - Math.abs(amt)
      } else {
        map[cat] = (map[cat] || 0) + amt
      }
    })
    return map
  }, [mergedAssets])

  const totalNetWorth = useMemo(() => {
    let assets = 0
    let debt = 0
    mergedAssets.forEach(a => {
      const amt = WealthCalculator.convertToCNY(a.amount, a.currency)
      if (a.category === 'debt') debt += Math.abs(amt)
      else assets += amt
    })
    return assets - debt
  }, [mergedAssets])

  // 过滤
  const filteredAssets = useMemo(() => {
    return mergedAssets.filter(a => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
      return true
    })
  }, [mergedAssets, categoryFilter])

  // ============= 弹窗 =============
  const openAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ currency: 'CNY' })
    setModalOpen(true)
  }

  const openEdit = (record: Asset) => {
    if (record.isLinked) {
      message.warning('联动资产请到「持仓管理」中编辑')
      return
    }
    setEditing(record)
    form.setFieldsValue({
      category: record.category,
      type: record.type,
      name: record.name,
      amount: record.amount,
      currency: record.currency,
      description: record.description
    })
    setModalOpen(true)
  }

  const submit = async () => {
    try {
      setSubmitting(true)
      const values = await form.validateFields()
      const data = {
        category: values.category,
        type: values.type,
        name: values.name,
        amount: values.amount,
        currency: values.currency,
        description: values.description
      }
      if (editing) {
        await updateAsset(editing.id, data)
        message.success('已更新')
      } else {
        await addAsset(data)
        message.success('已添加')
      }
      setModalOpen(false)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset(id)
      message.success('已删除')
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  const handleAddCustom = () => {
    if (!customName.trim()) {
      message.error('请输入类型名称')
      return
    }
    const key = `custom_${Date.now()}` as AssetSubType
    addCustomType(key, customName.trim(), customCategory)
    form.setFieldsValue({ type: key, category: customCategory })
    setCustomModalOpen(false)
    setCustomName('')
    message.success('已添加自定义类型')
  }

  // ============= 表格列 =============
  const columns: ColumnsType<Asset> = [
    {
      title: '资产',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (name: string, record) => {
        const catMeta = ASSET_CATEGORY_META[record.category as AssetCategory]
        const subMeta = ASSET_SUBTYPE_META[record.type]
        const color = CATEGORY_COLORS[record.category] || '#888'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `${color}15`,
              color: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0
            }}>
              {CATEGORY_ICONS[record.category] || subMeta?.icon || '·'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontWeight: 600, fontSize: 14, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 6,
                lineHeight: 1.3
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{name}</span>
                {record.isLinked && (
                  <Tooltip title="联动持仓：价格随「持仓管理」实时变化">
                    <span className="chip ink" style={{ fontSize: 10, padding: '0 6px', flexShrink: 0 }}>
                      <span className="live-dot" style={{ width: 5, height: 5 }} />
                      联动
                    </span>
                  </Tooltip>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.3 }}>
                {catMeta?.label?.split(' ')[1] || record.category} · {subMeta?.label || record.type}
                {record.symbol && <span className="num" style={{ marginLeft: 6 }}>· {record.symbol}</span>}
              </div>
            </div>
          </div>
        )
      }
    },
    {
      title: '金额（人民币）',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      width: 200,
      sorter: (a, b) => {
        const aCNY = WealthCalculator.convertToCNY(a.amount, a.currency)
        const bCNY = WealthCalculator.convertToCNY(b.amount, b.currency)
        return aCNY - bCNY
      },
      render: (amount: number, record) => {
        const cny = WealthCalculator.convertToCNY(amount, record.currency)
        return (
          <div>
            <div className="num" style={{
              fontSize: 15, fontWeight: 700,
              color: record.category === 'debt' ? '#d63b3b' : 'var(--text-primary)'
            }}>
              {record.category === 'debt' ? '-' : ''}¥{fmt(cny)}
            </div>
            {record.currency !== 'CNY' && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }} className="num">
                {fmt(amount)} {record.currency}
              </div>
            )}
          </div>
        )
      }
    },
    {
      title: '占比',
      key: 'ratio',
      align: 'right' as const,
      width: 120,
      render: (_: any, record) => {
        const cny = WealthCalculator.convertToCNY(record.amount, record.currency)
        const ratio = totalNetWorth > 0 ? (cny / totalNetWorth) * 100 : 0
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <div className="progress-track" style={{ width: 60, height: 4 }}>
              <div className="progress-fill" style={{
                width: `${Math.min(100, ratio)}%`,
                background: CATEGORY_COLORS[record.category]
              }} />
            </div>
            <span className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 42, textAlign: 'right' }}>
              {ratio.toFixed(1)}%
            </span>
          </div>
        )
      }
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      width: 140,
      ellipsis: true,
      render: (d?: string) => d ? (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{d}</span>
      ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'center' as const,
      render: (_: any, record) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
            disabled={!!record.isLinked}
          />
          <Popconfirm
            title="确定删除该资产？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!!record.isLinked}
            />
          </Popconfirm>
        </div>
      )
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ============ Section Title ============ */}
      <div className="section-header fade-in">
        <div>
          <div className="section-eyebrow">Asset Management</div>
          <h1 className="section-title">资产管理</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { loadAssets(); loadHoldings() }}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAdd}
            style={{
              background: 'var(--ink-950)',
              borderColor: 'var(--ink-950)',
              fontWeight: 600
            }}
          >
            添加资产
          </Button>
        </div>
      </div>

      {/* ============ Category Pills ============ */}
      <div className="panel fade-in-1" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {Object.entries(ASSET_CATEGORY_META).map(([k, v]) => ({
            key: k, label: v.label.split(' ')[1] || k, color: CATEGORY_COLORS[k],
            icon: CATEGORY_ICONS[k] || v.icon
          })).map(c => {
            const isActive = categoryFilter === c.key
            const amount = categorySummary[c.key]
            return (
              <div
                key={c.key}
                onClick={() => setCategoryFilter(c.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: isActive ? c.color : 'var(--app-bg)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  border: isActive ? `1px solid ${c.color}` : '1px solid transparent',
                  transition: 'all 0.2s var(--ease-out)'
                }}
              >
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 6,
                  textAlign: 'center',
                  opacity: isActive ? 0.95 : 0.8
                }}>
                  {c.label}
                </div>
                {amount !== undefined && (
                  <div className="num" style={{
                    fontSize: 18,
                    fontWeight: 700,
                    textAlign: 'center',
                    opacity: isActive ? 1 : 0.75
                  }}>
                    <CompactNumber value={Math.abs(amount)} prefix="¥" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ============ Asset Table (Desktop) ============ */}
      <div className="panel luxe-table fade-in-2 desktop-only">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredAssets}
          pagination={false}
          tableLayout="fixed"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                    暂无资产，点击右上「添加资产」开始
                  </span>
                }
              />
            )
          }}
        />
      </div>

      {/* ============ Asset Cards (Mobile) ============ */}
      <div className="mobile-card-list fade-in-2">
        {filteredAssets.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                暂无资产，点击上方「添加资产」开始
              </span>
            }
          />
        ) : (
          filteredAssets.map(record => {
            const catMeta = ASSET_CATEGORY_META[record.category as AssetCategory]
            const subMeta = ASSET_SUBTYPE_META[record.type]
            const color = CATEGORY_COLORS[record.category] || '#888'
            const cny = WealthCalculator.convertToCNY(record.amount, record.currency)
            const ratio = totalNetWorth > 0 ? (cny / totalNetWorth) * 100 : 0
            return (
              <div key={record.id} className="mobile-card">
                <div className="mobile-card-row">
                  <div className="mobile-card-left">
                    <div className="mobile-card-icon" style={{ background: `${color}15`, color }}>
                      {CATEGORY_ICONS[record.category] || subMeta?.icon || '·'}
                    </div>
                    <div className="mobile-card-info">
                      <div className="mobile-card-title">
                        {record.name}
                        {record.isLinked && (
                          <span className="chip ink" style={{ fontSize: 10, padding: '0 6px', marginLeft: 6 }}>
                            <span className="live-dot" style={{ width: 5, height: 5 }} />
                            联动
                          </span>
                        )}
                      </div>
                      <div className="mobile-card-sub">
                        {catMeta?.label?.split(' ')[1] || record.category} · {subMeta?.label || record.type}
                        {record.symbol && <span className="num" style={{ marginLeft: 6 }}>· {record.symbol}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mobile-card-right">
                    <div className="mobile-card-amount" style={{ color: record.category === 'debt' ? '#d63b3b' : 'var(--text-primary)' }}>
                      {record.category === 'debt' ? '-' : ''}¥{fmt(cny)}
                    </div>
                    <div className="mobile-card-ratio">
                      <div className="progress-track" style={{ width: 40, height: 3 }}>
                        <div className="progress-fill" style={{ width: `${Math.min(100, ratio)}%`, background: color }} />
                      </div>
                      <span className="num">{ratio.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                {record.description && (
                  <div className="mobile-card-desc">{record.description}</div>
                )}
                <div className="mobile-card-actions">
                  <button
                    className="mobile-card-btn"
                    onClick={() => openEdit(record)}
                    disabled={!!record.isLinked}
                  >
                    <EditOutlined /> 编辑
                  </button>
                  <button
                    className="mobile-card-btn danger"
                    onClick={() => handleDelete(record.id)}
                    disabled={!!record.isLinked}
                  >
                    <DeleteOutlined /> 删除
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ============ Add/Edit Modal ============ */}
      <Modal
        title={
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>
            {editing ? '编辑资产' : '添加资产'}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        confirmLoading={submitting}
        okText={editing ? '保存' : '添加'}
        cancelText="取消"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={{ currency: 'CNY' }}>
          <Form.Item
            name="category"
            label="资产大类"
            rules={[{ required: true, message: '请选择资产大类' }]}
          >
            <Select
              placeholder="请选择"
              onChange={() => form.setFieldsValue({ type: undefined })}
              options={Object.entries(ASSET_CATEGORY_META).map(([k, v]) => ({
                value: k,
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: CATEGORY_COLORS[k] }}>{CATEGORY_ICONS[k]}</span>
                    {v.label.split(' ')[1]}
                  </span>
                )
              }))}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.category !== curr.category}
          >
            {({ getFieldValue }) => {
              const cat = getFieldValue('category') as AssetCategory | undefined
              if (!cat) return null
              const subs = getSubtypesByCategory(cat)
              const customs = customTypes.filter(c => c.category === cat)
              return (
                <Form.Item
                  name="type"
                  label="资产类型"
                  rules={[{ required: true, message: '请选择资产类型' }]}
                  extra={
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setCustomCategory(cat)
                        setCustomModalOpen(true)
                      }}
                      style={{ padding: 0, marginTop: 4 }}
                    >
                      + 添加自定义类型
                    </Button>
                  }
                >
                  <Select placeholder="请选择">
                    {subs.map(key => {
                      const meta = ASSET_SUBTYPE_META[key]
                      return (
                        <Select.Option key={key} value={key}>
                          <span style={{ marginRight: 6 }}>{meta.icon}</span>
                          {meta.label}
                        </Select.Option>
                      )
                    })}
                    {customs.map(c => (
                      <Select.Option key={c.type} value={c.type}>
                        ✨ {c.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item name="name" label="资产名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：招商银行活期" size="large" />
          </Form.Item>

          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }, { type: 'number', min: 0 }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              size="large"
              placeholder="0.00"
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            name="currency"
            label="货币"
            rules={[{ required: true, message: '请选择货币' }]}
          >
            <Select options={CURRENCY_OPTIONS} size="large" />
          </Form.Item>

          <Form.Item name="description" label="备注（可选）">
            <Input.TextArea rows={2} placeholder="银行、用途等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ============ Custom Type Modal ============ */}
      <Modal
        title={<span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>✨ 添加自定义类型</span>}
        open={customModalOpen}
        onCancel={() => setCustomModalOpen(false)}
        onOk={handleAddCustom}
        okText="添加"
        cancelText="取消"
        width={420}
      >
        <div style={{ padding: '12px 0' }}>
          <Form layout="vertical">
            <Form.Item label="类型名称" required>
              <Input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="例如：私募基金"
                size="large"
              />
            </Form.Item>
            <Form.Item label="归属大类">
              <Select
                value={customCategory}
                onChange={setCustomCategory}
                size="large"
                options={Object.entries(ASSET_CATEGORY_META).map(([k, v]) => ({
                  value: k,
                  label: v.label.split(' ')[1]
                }))}
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  )
}
