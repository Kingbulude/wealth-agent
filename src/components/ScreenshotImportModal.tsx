import React, { useState } from 'react'
import { Modal, Button, Upload, Table, Tag, Input, InputNumber, Form, App as AntApp } from 'antd'
import { UploadOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { recognizePositionScreenshot, RecognizedHolding, matchHoldingBySymbol } from '../services/ocrService'
import type { Holding } from '../types/holding'

export interface ImportHoldingData {
  name: string
  symbol: string
  quantity: number
  cost_price: number
  current_price: number
  market_value: number
  matched_holding_id: string | null
}

interface Props {
  visible: boolean
  onClose: () => void
  onImport: (holdings: ImportHoldingData[]) => void
  existingHoldings: Holding[]
}

const ScreenshotImportModal: React.FC<Props> = ({ visible, onClose, onImport, existingHoldings }) => {
  const { message } = AntApp.useApp()
  const [uploading, setUploading] = useState(false)
  const [recognizedHoldings, setRecognizedHoldings] = useState<RecognizedHolding[]>([])
  const [dataSource, setDataSource] = useState<any[]>([])
  const [form] = Form.useForm()

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const result = await recognizePositionScreenshot(file)
      if (!result.success) {
        message.error(result.error || '识别失败')
        return
      }
      if (result.holdings.length === 0) {
        message.warning('未能识别到持仓数据，请确保截图包含清晰的持仓信息')
        return
      }
      setRecognizedHoldings(result.holdings)
      const rows = result.holdings.map((h, index) => {
        const matched = matchHoldingBySymbol(h.symbol, existingHoldings)
        return {
          key: index,
          name: h.name,
          symbol: h.symbol,
          quantity: h.quantity,
          costPrice: h.costPrice,
          currentPrice: h.currentPrice,
          marketValue: h.marketValue,
          matched: matched ? matched.id : null,
          matchedName: matched ? matched.name : null,
          action: matched ? 'update' : 'create',
          _original: h
        }
      })
      setDataSource(rows)
      form.setFieldsValue(rows.reduce((acc, row) => ({ ...acc, [row.key]: row }), {}))
    } catch (error) {
      message.error('识别过程出错')
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleActionChange = (key: number, action: 'create' | 'update' | 'skip') => {
    setDataSource(prev => prev.map(row => 
      row.key === key ? { ...row, action } : row
    ))
  }

  const handleFieldChange = (key: number, field: string, value: any) => {
    setDataSource(prev => prev.map(row => 
      row.key === key ? { ...row, [field]: value } : row
    ))
  }

  const handleImport = () => {
    const toImport = dataSource
      .filter(row => row.action !== 'skip')
      .map(row => ({
        name: row.name,
        symbol: row.symbol,
        quantity: row.quantity,
        cost_price: row.costPrice,
        current_price: row.currentPrice || row.costPrice,
        market_value: row.marketValue || (row.quantity * (row.currentPrice || row.costPrice)),
        matched_holding_id: row.action === 'update' ? row.matched : null
      }))
    
    if (toImport.length === 0) {
      message.warning('没有选择任何持仓进行导入')
      return
    }
    
    onImport(toImport)
    onClose()
  }

  const columns = [
    {
      title: '股票名称',
      dataIndex: 'name',
      width: 120,
      render: (text: string, record: any) => (
        <div>
          <Input
            size="small"
            value={text}
            onChange={(e) => handleFieldChange(record.key, 'name', e.target.value)}
            style={{ width: '100%' }}
          />
          {record.matchedName && (
            <Tag color="blue" style={{ marginTop: 4, fontSize: 11 }}>
              已存在: {record.matchedName}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: '代码',
      dataIndex: 'symbol',
      width: 100,
      render: (text: string, record: any) => (
        <Input
          size="small"
          value={text}
          onChange={(e) => handleFieldChange(record.key, 'symbol', e.target.value)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '持仓数量',
      dataIndex: 'quantity',
      width: 100,
      render: (text: number, record: any) => (
        <InputNumber
          size="small"
          value={text}
          onChange={(value: number | null) => handleFieldChange(record.key, 'quantity', value || 0)}
          style={{ width: '100%' }}
          min={0}
        />
      )
    },
    {
      title: '成本价',
      dataIndex: 'costPrice',
      width: 100,
      render: (text: number, record: any) => (
        <InputNumber
          size="small"
          value={text}
          onChange={(value: number | null) => handleFieldChange(record.key, 'costPrice', value || 0)}
          style={{ width: '100%' }}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: '现价',
      dataIndex: 'currentPrice',
      width: 100,
      render: (text: number, record: any) => (
        <InputNumber
          size="small"
          value={text}
          onChange={(value: number | null) => handleFieldChange(record.key, 'currentPrice', value || 0)}
          style={{ width: '100%' }}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: '市值',
      dataIndex: 'marketValue',
      width: 120,
      render: (text: number) => text?.toLocaleString()
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 140,
      render: (text: string, record: any) => (
        <select
          value={text}
          onChange={(e) => handleActionChange(record.key, e.target.value as any)}
          style={{
            padding: 4,
            borderRadius: 4,
            border: '1px solid #d9d9d9',
            fontSize: 12
          }}
        >
          <option value="create">新建持仓</option>
          <option value="update">更新已有</option>
          <option value="skip">跳过</option>
        </select>
      )
    }
  ]

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="截图导入持仓"
      width={800}
      footer={[
        <Button key="back" onClick={onClose}>取消</Button>,
        <Button key="import" type="primary" onClick={handleImport} disabled={dataSource.length === 0}>
          确认导入
        </Button>
      ]}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
          请上传同花顺持仓页面的截图，系统将自动识别并导入持仓数据。
        </div>
        <Upload
          beforeUpload={handleUpload}
          accept="image/*"
          showUploadList={false}
          disabled={uploading}
        >
          <Button icon={<UploadOutlined />} loading={uploading}>
            {uploading ? '识别中...' : '上传截图'}
          </Button>
        </Upload>
      </div>

      {recognizedHoldings.length > 0 && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>已识别 {recognizedHoldings.length} 条持仓数据</span>
          </div>
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="small"
            bordered
          />
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(58,111,199,0.05)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <p><strong>操作说明：</strong></p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li><strong>新建持仓</strong>：在系统中不存在此股票时使用</li>
                <li><strong>更新已有</strong>：系统已存在此股票，更新持仓数量和成本价</li>
                <li><strong>跳过</strong>：不导入此条数据</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {recognizedHoldings.length === 0 && !uploading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
          <div>点击上方按钮上传同花顺持仓截图</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>支持 PNG、JPG 格式</div>
        </div>
      )}
    </Modal>
  )
}

export default ScreenshotImportModal