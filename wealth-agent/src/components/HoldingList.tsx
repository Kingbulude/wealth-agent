import { useState, useEffect } from 'react'
import { Table, Button, Space, Tag, Popconfirm, message, Card, Modal, Form, Input, InputNumber, Select, Statistic, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { Holding, STOCK_META, FUND_META } from '../types/holding'
import { useHoldingStore } from '../stores/holdingStore'

const { Option } = Select

export default function HoldingList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editData, setEditData] = useState<Holding | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'stock' | 'fund'>('all')
  const [form] = Form.useForm()
  
  const { loadHoldings, deleteHolding, getHoldingsByType, getTotalValue, getTotalProfit } = useHoldingStore()

  useEffect(() => {
    loadHoldings()
  }, [])

  const filteredHoldings = getHoldingsByType(filterType)

  const handleEdit = (record: Holding) => {
    setEditData(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    await deleteHolding(id)
    message.success('删除成功')
  }

  const handleModalClose = () => {
    setModalVisible(false)
    setEditData(null)
    form.resetFields()
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const { addHolding, updateHolding } = useHoldingStore.getState()
      
      if (editData) {
        await updateHolding(editData.id, values)
        message.success('持仓更新成功')
      } else {
        await addHolding(values)
        message.success('持仓添加成功')
      }
      
      handleModalClose()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  const handleSymbolChange = (value: string) => {
    const symbol = value.toUpperCase()
    let name = ''
    
    if (STOCK_META[symbol]) {
      name = STOCK_META[symbol]
    } else if (FUND_META[symbol]) {
      name = FUND_META[symbol]
    } else {
      // 如果没有匹配的名称，让用户手动输入
      name = ''
    }
    
    form.setFieldsValue({ name })
  }

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: 'stock' | 'fund') => (
        <Tag color={type === 'stock' ? 'blue' : 'purple'}>
          {type === 'stock' ? '股票' : '基金'}
        </Tag>
      )
    },
    {
      title: '代码',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      render: (symbol: string) => <code>{symbol}</code>
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>
    },
    {
      title: '持仓数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (qty: number) => qty.toLocaleString()
    },
    {
      title: '成本价',
      dataIndex: 'avgCost',
      key: 'avgCost',
      width: 100,
      render: (cost: number) => `¥${cost.toFixed(2)}`
    },
    {
      title: '当前价',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 100,
      render: (price: number) => `¥${price.toFixed(2)}`
    },
    {
      title: '成本',
      key: 'totalCost',
      width: 120,
      render: (_: any, record: Holding) => {
        const cost = record.quantity * record.avgCost
        return `¥${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
    },
    {
      title: '市值',
      key: 'marketValue',
      width: 120,
      render: (_: any, record: Holding) => {
        const value = record.quantity * record.currentPrice
        return `¥${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
    },
    {
      title: '盈亏',
      key: 'profit',
      width: 120,
      render: (_: any, record: Holding) => {
        const profit = (record.currentPrice - record.avgCost) * record.quantity
        const profitRate = ((record.currentPrice - record.avgCost) / record.avgCost) * 100
        const color = profit >= 0 ? '#52c41a' : '#f5222d'
        
        return (
          <div style={{ color }}>
            <div>{profit >= 0 ? '+' : ''}{profit.toFixed(2)}</div>
            <div style={{ fontSize: 12 }}>
              {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
            </div>
          </div>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Holding) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条持仓吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
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
              title="股票盈亏"
              value={getTotalProfit('stock')}
              prefix={getTotalProfit('stock') >= 0 ? '+' : ''}
              precision={2}
              valueStyle={{ color: getTotalProfit('stock') >= 0 ? '#52c41a' : '#f5222d' }}
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
              title="基金盈亏"
              value={getTotalProfit('fund')}
              prefix={getTotalProfit('fund') >= 0 ? '+' : ''}
              precision={2}
              valueStyle={{ color: getTotalProfit('fund') >= 0 ? '#52c41a' : '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

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
          locale={{ emptyText: '暂无持仓，点击上方按钮添加' }}
        />
      </Card>

      {/* 添加/编辑Modal */}
      <Modal
        title={editData ? '编辑持仓' : '添加持仓'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleModalClose}
        okText={editData ? '保存' : '添加'}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'stock'
          }}
        >
          <Form.Item
            name="type"
            label="持仓类型"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="stock">股票</Option>
              <Option value="fund">基金</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="symbol"
            label="代码"
            rules={[{ required: true, message: '请输入股票/基金代码' }]}
            extra={
              <span style={{ color: '#999', fontSize: 12 }}>
                常用代码：股票 600519(茅台) 000001(平安) 601318(平安)，
                基金 110022(易方达) 161725(招商中证白酒)
              </span>
            }
          >
            <Input 
              placeholder="如：600519" 
              onChange={(e) => handleSymbolChange(e.target.value)}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：贵州茅台" />
          </Form.Item>

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
              { type: 'number', min: 0.01, message: '成本至少为0.01' }
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
