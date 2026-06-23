import { useState, useEffect, useRef } from 'react'
import {
  Table, Button, Space, Tag, Popconfirm, message, Card, Modal, Form, Input, InputNumber, Select, Statistic, Row, Col, AutoComplete, Tooltip
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Holding } from '../types/holding'
import { useHoldingStore } from '../stores/holdingStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { searchSecurities, StockSearchResult, fetchStockPrice, fetchFundNav } from '../services/stockService'
import { UP_COLOR, DOWN_COLOR, FLAT_COLOR } from '../utils/financeColor'

const { Option } = Select

export default function HoldingList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editData, setEditData] = useState<Holding | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'stock' | 'fund'>('all')
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [previewPrice, setPreviewPrice] = useState<{ price: number; source: string } | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [form] = Form.useForm()
  const searchTimerRef = useRef<number | null>(null)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { loadHoldings, deleteHolding, getHoldingsByType, getTotalValue, getTotalProfit, refreshPrices, refreshing } = useHoldingStore()

  useEffect(() => {
    loadHoldings()
    // 持仓页面：每 30 秒自动刷新行情
    autoRefreshRef.current = setInterval(() => {
      refreshPrices()
    }, 30_000)
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
        autoRefreshRef.current = null
      }
    }
  }, [])

  const filteredHoldings = getHoldingsByType(filterType)

  // ============== 搜索/自动补全 ==============
  const handleSearch = (value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!value || value.trim().length === 0) {
      setSearchResults([])
      return
    }
    // 防抖 300ms
    searchTimerRef.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const type = (form.getFieldValue('type') || 'stock') as 'stock' | 'fund'
        const results = await searchSecurities(value, type)
        setSearchResults(results)
      } catch (e) {
        console.error('搜索失败:', e)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  // 选中搜索项后，自动反查当前价 + 写入代码/名称
  const handleSearchSelect = async (code: string, option: any) => {
    form.setFieldsValue({ symbol: code, name: option.name || option.label })
    setSearchResults([])
    setPreviewPrice(null)

    // 自动拉取一次当前价
    setLoadingPrice(true)
    try {
      const type = (form.getFieldValue('type') || 'stock') as 'stock' | 'fund'
      if (type === 'stock') {
        const data = await fetchStockPrice(code)
        if (data && data.price > 0) {
          setPreviewPrice({ price: data.price, source: data.name })
          form.setFieldsValue({ name: data.name })
        } else {
          message.warning('未能获取当前价，请稍后手动刷新')
        }
      } else {
        const data = await fetchFundNav(code)
        if (data && data.nav > 0) {
          setPreviewPrice({ price: data.nav, source: data.name })
          form.setFieldsValue({ name: data.name })
        } else {
          message.warning('未能获取基金净值，请稍后手动刷新')
        }
      }
    } catch (e) {
      console.error('拉取当前价失败:', e)
    } finally {
      setLoadingPrice(false)
    }
  }

  // 当用户输入的是纯 6 位数字时，尝试直接反查（不依赖字典）
  const handleSearchBlur = async () => {
    const value: string = form.getFieldValue('symbol') || ''
    if (/^\d{6}$/.test(value)) {
      const currentName = form.getFieldValue('name')
      if (currentName) return  // 已经有名称了
      setLoadingPrice(true)
      try {
        const type = (form.getFieldValue('type') || 'stock') as 'stock' | 'fund'
        if (type === 'stock') {
          const data = await fetchStockPrice(value)
          if (data && data.name) {
            form.setFieldsValue({ name: data.name })
            setPreviewPrice({ price: data.price, source: data.name })
          }
        } else {
          const data = await fetchFundNav(value)
          if (data && data.name) {
            form.setFieldsValue({ name: data.name })
            setPreviewPrice({ price: data.nav, source: data.name })
          }
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingPrice(false)
      }
    }
  }

  // ============== 提交 ==============
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (!values.symbol) {
        message.error('请选择或输入股票/基金')
        return
      }
      // 标准化代码：去空格
      values.symbol = String(values.symbol).trim()
      // 如果是 6 位数字但名称是空的，强制要求名称
      if (!values.name) {
        if (previewPrice?.source) {
          values.name = previewPrice.source
        } else {
          message.error('请填写名称（可点击搜索结果自动填入）')
          return
        }
      }

      // 当前价：优先用预览价；否则用 avgCost 兜底（避免 0 显示）
      const currentPrice = previewPrice?.price || values.avgCost || 0

      const submitData = {
        ...values,
        currentPrice
      }

      const { addHolding, updateHolding } = useHoldingStore.getState()

      if (editData) {
        await updateHolding(editData.id, submitData)
        message.success('持仓更新成功')
      } else {
        await addHolding(submitData)
        message.success('持仓添加成功')
      }

      handleModalClose()
      // 通知所有 Tab 刷新数据
      usePortfolioStore.getState().loadPortfolio()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  const handleEdit = (record: Holding) => {
    setEditData(record)
    form.setFieldsValue({
      type: record.type,
      symbol: record.symbol,
      name: record.name,
      quantity: record.quantity,
      avgCost: record.avgCost
    })
    setPreviewPrice({ price: record.currentPrice, source: record.name })
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    await deleteHolding(id)
    message.success('删除成功')
    usePortfolioStore.getState().loadPortfolio()
  }

  const handleModalClose = () => {
    setModalVisible(false)
    setEditData(null)
    setSearchResults([])
    setPreviewPrice(null)
    form.resetFields()
  }

  // 类型切换时清空当前搜索结果
  const handleTypeChange = (val: 'stock' | 'fund') => {
    form.setFieldsValue({ symbol: '', name: '' })
    setSearchResults([])
    setPreviewPrice(null)
  }

  // ============== 表格列 ==============
  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: 'stock' | 'fund') => (
        <Tag color={type === 'stock' ? 'blue' : 'purple'}>
          {type === 'stock' ? '股票' : '基金'}
        </Tag>
      )
    },
    {
      title: '名称 / 代码',
      key: 'nameCode',
      width: 200,
      render: (_: any, record: Holding) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.symbol}</div>
        </div>
      )
    },
    {
      title: '持仓数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (qty: number) => qty.toLocaleString()
    },
    {
      title: '成本价',
      dataIndex: 'avgCost',
      key: 'avgCost',
      width: 100,
      align: 'right' as const,
      render: (cost: number) => `¥${cost.toFixed(2)}`
    },
    {
      title: '当前价',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 110,
      align: 'right' as const,
      render: (price: number, record: Holding) => {
        if (!price || price === record.avgCost) {
          return <span style={{ color: '#999' }}>未刷新</span>
        }
        return <span style={{ color: '#1890ff', fontWeight: 500 }}>¥{price.toFixed(2)}</span>
      }
    },
    {
      title: '市值',
      key: 'marketValue',
      width: 130,
      align: 'right' as const,
      render: (_: any, record: Holding) => {
        const v = record.quantity * record.currentPrice
        return `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
    },
    {
      title: '浮动盈亏',
      key: 'profit',
      width: 150,
      align: 'right' as const,
      render: (_: any, record: Holding) => {
        const profit = (record.currentPrice - record.avgCost) * record.quantity
        const profitRate = record.avgCost > 0 ? ((record.currentPrice - record.avgCost) / record.avgCost) * 100 : 0
        const color = profit > 0 ? UP_COLOR : profit < 0 ? DOWN_COLOR : FLAT_COLOR
        const sign = profit > 0 ? '+' : ''
        return (
          <div style={{ color, fontWeight: 500 }}>
            <div>{sign}{profit.toFixed(2)}</div>
            <div style={{ fontSize: 12 }}>
              {sign}{profitRate.toFixed(2)}%
            </div>
          </div>
        )
      }
    },
    {
      title: '更新时间',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      width: 150,
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, record: Holding) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条持仓吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="股票市值"
              value={getTotalValue('stock')}
              prefix="¥"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="股票浮动盈亏"
              value={getTotalProfit('stock')}
              precision={2}
              valueStyle={{ color: getTotalProfit('stock') > 0 ? UP_COLOR : getTotalProfit('stock') < 0 ? DOWN_COLOR : FLAT_COLOR }}
              suffix={getTotalProfit('stock') > 0 ? ' ↑' : getTotalProfit('stock') < 0 ? ' ↓' : ''}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="基金市值"
              value={getTotalValue('fund')}
              prefix="¥"
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="基金浮动盈亏"
              value={getTotalProfit('fund')}
              precision={2}
              valueStyle={{ color: getTotalProfit('fund') > 0 ? UP_COLOR : getTotalProfit('fund') < 0 ? DOWN_COLOR : FLAT_COLOR }}
              suffix={getTotalProfit('fund') > 0 ? ' ↑' : getTotalProfit('fund') < 0 ? ' ↓' : ''}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text>
          <Tooltip title="点击刷新按钮可拉取所有持仓的最新当前价（市值、盈亏会自动重算）">
            <Tag color="cyan">实时联动</Tag>
          </Tooltip>
          <span style={{ color: '#999', marginLeft: 8 }}>
            盈亏 = (当前价 − 成本价) × 持仓数量；当前价来自实时行情
          </span>
        </Text>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={refreshing}
            onClick={async () => {
              message.info('正在获取最新行情（多源并发）...')
              const result = await refreshPrices()
              if (result && result.successCount > 0) {
                message.success(`已更新 ${result.successCount}/${result.totalCount} 个标的当前价`)
              } else if (result && result.totalCount > 0) {
                message.warning('未能获取行情数据，请稍后重试')
              }
              // 同时通知 portfolio store 刷新
              usePortfolioStore.getState().loadPortfolio()
            }}
          >
            刷新行情
          </Button>
        </Space>
      </div>

      {/* 持仓列表 */}
      <Card
        title="我的持仓"
        extra={
          <Space>
            <Select
              value={filterType}
              onChange={setFilterType}
              style={{ width: 120 }}
            >
              <Option value="all">全部</Option>
              <Option value="stock">股票</Option>
              <Option value="fund">基金</Option>
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditData(null)
                form.resetFields()
                setPreviewPrice(null)
                setModalVisible(true)
              }}
            >
              添加持仓
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredHoldings}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
          locale={{ emptyText: '暂无持仓，点击「添加持仓」开始' }}
        />
      </Card>

      {/* 添加/编辑 Modal */}
      <Modal
        title={editData ? '编辑持仓' : '添加持仓'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleModalClose}
        okText={editData ? '保存' : '添加'}
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'stock' }}
        >
          <Form.Item
            name="type"
            label="持仓类型"
            rules={[{ required: true }]}
          >
            <Select onChange={handleTypeChange}>
              <Option value="stock">股票</Option>
              <Option value="fund">基金</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="symbol"
            label="代码 / 名称"
            rules={[{ required: true, message: '请输入代码或名称' }]}
            extra={
              <span style={{ color: '#999', fontSize: 12 }}>
                💡 输入「茅台」/「600519」/「GZMT」均可联想；选中后自动同步代码与名称，并实时拉取当前价
              </span>
            }
          >
            <AutoComplete
              options={searchResults.map(item => ({
                value: item.code,
                key: item.code,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {item.code}
                      {item.pinyin ? ` · ${item.pinyin}` : ''}
                      {item.market ? ` · ${item.market}` : ''}
                    </span>
                  </div>
                ),
                name: item.name
              }))}
              onSearch={handleSearch}
              onSelect={(value, option: any) => handleSearchSelect(value, option)}
              onBlur={handleSearchBlur}
              placeholder="输入代码 / 名称 / 拼音首字母，如：茅台、600519、GZMT"
              notFoundContent={searching ? '搜索中…' : '暂无匹配，尝试输入股票代码'}
              filterOption={false}
              allowClear
            >
              <Input prefix={<SearchOutlined />} />
            </AutoComplete>
          </Form.Item>

          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称（选股票后自动填入）' }]}
          >
            <Input placeholder="自动从行情接口同步" />
          </Form.Item>

          {previewPrice && (
            <div style={{
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: '#1890ff' }}>📈 当前价（实时）</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>
                ¥{previewPrice.price.toFixed(2)}
              </span>
            </div>
          )}
          {loadingPrice && (
            <div style={{ color: '#999', marginBottom: 16, fontSize: 12 }}>⏳ 正在拉取最新价…</div>
          )}

          <Form.Item
            name="quantity"
            label="持仓数量"
            rules={[
              { required: true, message: '请输入持仓数量' },
              { type: 'number', min: 1, message: '数量至少为1' }
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} placeholder="如：100" />
          </Form.Item>

          <Form.Item
            name="avgCost"
            label="平均成本（元）"
            rules={[
              { required: true, message: '请输入平均成本' },
              { type: 'number', min: 0.01, message: '成本至少为 0.01' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              placeholder="如：1800.00"
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// 简单封装，避免引入 Typography 多余包
const Text: React.FC<{ children: React.ReactNode; type?: string; style?: React.CSSProperties }> = ({ children, type, style }) => (
  <span style={{ color: type === 'secondary' ? '#999' : 'inherit', ...style }}>{children}</span>
)
