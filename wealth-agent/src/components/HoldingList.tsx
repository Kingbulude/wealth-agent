import { useState, useEffect } from 'react'
import { Table, Button, Space, Tag, Popconfirm, message, Card, Modal, Form, Input, InputNumber, Select, Statistic, Row, Col, AutoComplete } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { Holding } from '../types/holding'
import { useHoldingStore } from '../stores/holdingStore'

const { Option } = Select

const STOCK_LIST = [
  { code: '600519', name: '贵州茅台' },
  { code: '000001', name: '平安银行' },
  { code: '601318', name: '中国平安' },
  { code: '000858', name: '五粮液' },
  { code: '600036', name: '招商银行' },
  { code: '601888', name: '中国中免' },
  { code: '002475', name: '立讯精密' },
  { code: '300750', name: '宁德时代' },
  { code: '600276', name: '恒瑞医药' },
  { code: '000333', name: '美的集团' },
  { code: '600900', name: '长江电力' },
  { code: '601012', name: '隆基绿能' },
  { code: '002594', name: '比亚迪' },
  { code: '600030', name: '中信证券' },
  { code: '601398', name: '工商银行' },
  { code: '601939', name: '建设银行' },
  { code: '600028', name: '中国石化' },
  { code: '601857', name: '中国石油' },
  { code: '600050', name: '中国联通' },
  { code: '601628', name: '中国人寿' },
  { code: '600887', name: '伊利股份' },
  { code: '000568', name: '泸州老窖' },
  { code: '600809', name: '山西汾酒' },
  { code: '000799', name: '酒鬼酒' },
  { code: '603259', name: '药明康德' },
  { code: '300760', name: '迈瑞医疗' },
  { code: '600436', name: '片仔癀' },
  { code: '000538', name: '云南白药' },
  { code: '600585', name: '海螺水泥' },
  { code: '601888', name: '中国中免' },
  { code: '600196', name: '复星医药' },
  { code: '002230', name: '科大讯飞' },
  { code: '300059', name: '东方财富' },
  { code: '002415', name: '海康威视' },
  { code: '600000', name: '浦发银行' },
  { code: '600016', name: '民生银行' },
  { code: '600018', name: '上港集团' },
  { code: '600019', name: '宝钢股份' },
  { code: '600025', name: '华能水电' },
  { code: '600028', name: '中国石化' },
  { code: '600030', name: '中信证券' },
  { code: '600031', name: '三一重工' },
  { code: '600036', name: '招商银行' },
  { code: '600048', name: '保利发展' },
  { code: '600050', name: '中国联通' },
  { code: '600061', name: '国投资本' },
  { code: '600085', name: '同仁堂' },
  { code: '600104', name: '上汽集团' },
  { code: '600111', name: '北方稀土' },
  { code: '600150', name: '中国船舶' },
  { code: '600188', name: '兖矿能源' },
  { code: '600196', name: '复星医药' },
  { code: '600276', name: '恒瑞医药' },
  { code: '600309', name: '万华化学' },
  { code: '600340', name: '华夏幸福' },
  { code: '600436', name: '片仔癀' },
  { code: '600438', name: '通威股份' },
  { code: '600487', name: '亨通光电' },
  { code: '600519', name: '贵州茅台' },
  { code: '600547', name: '山东黄金' },
  { code: '600570', name: '恒生电子' },
  { code: '600585', name: '海螺水泥' },
  { code: '600588', name: '用友网络' },
  { code: '600600', name: '青岛啤酒' },
  { code: '600660', name: '福耀玻璃' },
  { code: '600690', name: '海尔智家' },
  { code: '600703', name: '三安光电' },
  { code: '600745', name: '闻泰科技' },
  { code: '600809', name: '山西汾酒' },
  { code: '600837', name: '海通证券' },
  { code: '600887', name: '伊利股份' },
  { code: '600893', name: '航发动力' },
  { code: '600905', name: '三峡能源' },
  { code: '600918', name: '中泰证券' },
  { code: '600941', name: '中国移动' },
  { code: '600958', name: '东方证券' },
  { code: '600989', name: '宝丰能源' },
  { code: '601006', name: '大秦铁路' },
  { code: '601012', name: '隆基绿能' },
  { code: '601066', name: '中信建投' },
  { code: '601088', name: '中国神华' },
  { code: '601138', name: '工业富联' },
  { code: '601166', name: '兴业银行' },
  { code: '601169', name: '北京银行' },
  { code: '601186', name: '中国铁建' },
  { code: '601211', name: '国泰君安' },
  { code: '601229', name: '上海银行' },
  { code: '601288', name: '农业银行' },
  { code: '601318', name: '中国平安' },
  { code: '601319', name: '中国人保' },
  { code: '601328', name: '交通银行' },
  { code: '601336', name: '新华保险' },
  { code: '601398', name: '工商银行' },
  { code: '601628', name: '中国人寿' },
  { code: '601633', name: '长城汽车' },
  { code: '601668', name: '中国建筑' },
  { code: '601688', name: '华泰证券' },
  { code: '601728', name: '中国电信' },
  { code: '601800', name: '中国交建' },
  { code: '601818', name: '光大银行' },
  { code: '601857', name: '中国石油' },
  { code: '601888', name: '中国中免' },
  { code: '601898', name: '中煤能源' },
  { code: '601899', name: '紫金矿业' },
  { code: '601919', name: '中远海控' },
  { code: '601939', name: '建设银行' },
  { code: '601988', name: '中国银行' },
  { code: '601995', name: '中金公司' },
  { code: '603019', name: '中科曙光' },
  { code: '603259', name: '药明康德' },
  { code: '603288', name: '海天味业' },
  { code: '603501', name: '韦尔股份' },
  { code: '603799', name: '华友钴业' },
  { code: '603986', name: '兆易创新' },
  { code: '000001', name: '平安银行' },
  { code: '000002', name: '万科A' },
  { code: '000063', name: '中兴通讯' },
  { code: '000066', name: '中国长城' },
  { code: '000100', name: 'TCL科技' },
  { code: '000333', name: '美的集团' },
  { code: '000538', name: '云南白药' },
  { code: '000568', name: '泸州老窖' },
  { code: '000625', name: '长安汽车' },
  { code: '000651', name: '格力电器' },
  { code: '000725', name: '京东方A' },
  { code: '000768', name: '中航西飞' },
  { code: '000776', name: '广发证券' },
  { code: '000799', name: '酒鬼酒' },
  { code: '000858', name: '五粮液' },
  { code: '000876', name: '新希望' },
  { code: '000938', name: '紫光股份' },
  { code: '000963', name: '华东医药' },
  { code: '000999', name: '华润三九' },
  { code: '002027', name: '分众传媒' },
  { code: '002230', name: '科大讯飞' },
  { code: '002241', name: '歌尔股份' },
  { code: '002271', name: '东方雨虹' },
  { code: '002304', name: '洋河股份' },
  { code: '002415', name: '海康威视' },
  { code: '002460', name: '赣锋锂业' },
  { code: '002466', name: '天齐锂业' },
  { code: '002475', name: '立讯精密' },
  { code: '002493', name: '荣盛石化' },
  { code: '002594', name: '比亚迪' },
  { code: '002607', name: '中公教育' },
  { code: '002714', name: '牧原股份' },
  { code: '002812', name: '恩捷股份' },
  { code: '300015', name: '爱尔眼科' },
  { code: '300059', name: '东方财富' },
  { code: '300122', name: '智飞生物' },
  { code: '300124', name: '汇川技术' },
  { code: '300142', name: '沃森生物' },
  { code: '300347', name: '泰格医药' },
  { code: '300408', name: '三环集团' },
  { code: '300433', name: '蓝思科技' },
  { code: '300498', name: '温氏股份' },
  { code: '300601', name: '康泰生物' },
  { code: '300750', name: '宁德时代' },
  { code: '300760', name: '迈瑞医疗' },
  { code: '300782', name: '卓胜微' },
  { code: '300866', name: '安克创新' },
  { code: '300888', name: '稳健医疗' },
  { code: '300999', name: '金龙鱼' }
]

const FUND_LIST = [
  { code: '110022', name: '易方达消费行业' },
  { code: '000961', name: '天弘沪深300ETF' },
  { code: '161725', name: '招商中证白酒' },
  { code: '159915', name: '创业板ETF' },
  { code: '512000', name: '华宝券商ETF' },
  { code: '110003', name: '易方达上证50' },
  { code: '161039', name: '富国先进制造' },
  { code: '005827', name: '易方达蓝筹精选' },
  { code: '003095', name: '中欧医疗健康' },
  { code: '161725', name: '招商中证白酒' },
  { code: '519677', name: '银河创新成长' },
  { code: '001102', name: '中欧明睿新常态' },
  { code: '006228', name: '南方信息创新' },
  { code: '008099', name: '东方阿尔法优势' },
  { code: '002083', name: '新华泛资源优势' }
]

function searchStocks(keyword: string, type: 'stock' | 'fund') {
  if (!keyword) return []
  const list = type === 'stock' ? STOCK_LIST : FUND_LIST
  const lower = keyword.toLowerCase()
  return list
    .filter(item => 
      item.code.includes(lower) || 
      item.name.toLowerCase().includes(lower) ||
      item.name.replace(/[A-Za-z]/g, '').includes(lower)
    )
    .slice(0, 20)
}

export default function HoldingList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editData, setEditData] = useState<Holding | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'stock' | 'fund'>('all')
  const [symbolOptions, setSymbolOptions] = useState<{ value: string; label: JSX.Element; code: string; name: string }[]>([])
  const [form] = Form.useForm()
  
  const { loadHoldings, deleteHolding, getHoldingsByType, getTotalValue, getTotalProfit, refreshPrices, refreshing } = useHoldingStore()

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
    if (!value) {
      setSymbolOptions([])
      return
    }
    const type = (form.getFieldValue('type') || 'stock') as 'stock' | 'fund'
    const isNumeric = /^\d+$/.test(value)
    
    if (isNumeric) {
      // 输入的是代码：直接精确匹配
      const list = type === 'stock' ? STOCK_LIST : FUND_LIST
      const exact = list.find(item => item.code === value)
      if (exact) {
        form.setFieldsValue({ name: exact.name })
      }
    } else {
      // 输入的是名称/缩写：搜索匹配
      const results = searchStocks(value, type)
      if (results.length === 1) {
        form.setFieldsValue({ symbol: results[0].code, name: results[0].name })
        setSymbolOptions([])
        return
      }
    }
    
    // 生成下拉选项
    const results = searchStocks(value, type)
    setSymbolOptions(results.map(item => ({
      value: item.code,
      code: item.code,
      name: item.name,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500 }}>{item.name}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{item.code}</span>
        </div>
      )
    })))
  }

  const handleSymbolSelect = (code: string, option: any) => {
    form.setFieldsValue({ 
      symbol: code,
      name: option.name
    })
    setSymbolOptions([])
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

      {/* 操作栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={async () => {
            message.info('正在获取最新行情...')
            const result = await refreshPrices()
            if (result && result.successCount > 0) {
              message.success(`成功刷新 ${result.successCount}/${result.totalCount} 个标的`)
            } else if (result && result.totalCount > 0) {
              message.warning('未能获取到行情数据，请稍后重试')
            }
          }}
        >
          刷新行情
        </Button>
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
            label="代码/名称"
            rules={[{ required: true, message: '请输入股票/基金代码或名称' }]}
            extra={
              <span style={{ color: '#999', fontSize: 12 }}>
                💡 支持：输入代码（如600519）自动显示名称，输入名称/缩写（如"茅台"）自动补全代码
              </span>
            }
          >
            <AutoComplete
              value={form.getFieldValue('symbol') || ''}
              options={symbolOptions}
              onSearch={handleSymbolChange}
              onSelect={handleSymbolSelect}
              placeholder="输入代码或名称/缩写，如：600519 或 茅台"
              filterOption={false}
              allowClear
            >
              {symbolOptions.map(opt => (
                <AutoComplete.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </AutoComplete.Option>
              ))}
            </AutoComplete>
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
