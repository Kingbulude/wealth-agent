import React, { useState } from 'react'
import { Modal, Button, Upload, Table, Input, InputNumber, Form, App as AntApp, Tag, Tooltip } from 'antd'
import { UploadOutlined, PlusOutlined, DeleteOutlined, InfoCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
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
  const [, setRecognizedHoldings] = useState<RecognizedHolding[]>([])
  const [dataSource, setDataSource] = useState<any[]>([])
  const [rawText, setRawText] = useState('')
  const [showRawText, setShowRawText] = useState(false)
  const [ocrEngine, setOcrEngine] = useState<string>('')
  const [parseError, setParseError] = useState('')
  const [form] = Form.useForm()

  const handleUpload = async (file: File) => {
    setUploading(true)
    setParseError('')
    try {
      const result = await recognizePositionScreenshot(file)
      setRawText(result.rawText)
      setOcrEngine(result.engine)

      if (!result.success) {
        setParseError(result.error || 'OCR 识别失败，请重试或使用其他截图')
        setDataSource([])
        return
      }

      if (result.holdings.length === 0) {
        setParseError(
          '未能自动识别到持仓数据。可能原因：\n' +
          '1. 截图包含账户概览页面（总资产/可用资金等），而非持仓列表\n' +
          '2. 持仓文字较小或模糊\n' +
          '3. 券商 APP 格式特殊\n\n' +
          '建议：上传持仓列表页面的截图，或使用「手动添加」。'
        )
        setDataSource([])
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

      if (result.holdings.length > 0) {
        message.success(`成功识别 ${result.holdings.length} 条持仓，请核对后确认导入`)
      }
    } catch (error) {
      setParseError('识别过程出错，请重试')
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

  const addManualRow = () => {
    const newKey = dataSource.length > 0 ? Math.max(...dataSource.map(r => r.key)) + 1 : 0
    const newRow = {
      key: newKey,
      name: '',
      symbol: '',
      quantity: 0,
      costPrice: 0,
      currentPrice: 0,
      marketValue: 0,
      matched: null,
      matchedName: null,
      action: 'create'
    }
    setDataSource(prev => [...prev, newRow])
  }

  const removeRow = (key: number) => {
    setDataSource(prev => prev.filter(row => row.key !== key))
  }

  const handleImport = () => {
    const toImport = dataSource
      .filter(row => row.action !== 'skip' && row.name)
      .map(row => ({
        name: row.name,
        symbol: row.symbol || '',
        quantity: row.quantity,
        cost_price: row.costPrice,
        current_price: row.currentPrice || row.costPrice,
        market_value: row.marketValue || (row.quantity * (row.currentPrice || row.costPrice)),
        matched_holding_id: row.action === 'update' ? row.matched : null
      }))

    if (toImport.length === 0) {
      message.warning('请至少填写股票名称')
      return
    }

    onImport(toImport)
    onClose()
  }

  const engineTag = ocrEngine === 'baidu'
    ? { color: 'blue' as const, text: '百度高精度' }
    : ocrEngine === 'tesseract'
      ? { color: 'orange' as const, text: '本地识别' }
      : ocrEngine === 'cloudflare'
        ? { color: 'purple' as const, text: '云端识别' }
        : { color: 'default' as const, text: '混合识别' }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 90,
      render: (text: string, record: any) => (
        <Input
          size="small"
          value={text}
          onChange={(e) => handleFieldChange(record.key, 'name', e.target.value)}
          style={{ width: '100%' }}
          placeholder="名称"
        />
      )
    },
    {
      title: '代码',
      dataIndex: 'symbol',
      width: 80,
      render: (text: string, record: any) => (
        <Input
          size="small"
          value={text}
          onChange={(e) => {
            const val = e.target.value.toUpperCase()
            handleFieldChange(record.key, 'symbol', val)
            const matched = matchHoldingBySymbol(val, existingHoldings)
            if (matched) {
              handleFieldChange(record.key, 'matched', matched.id)
              handleFieldChange(record.key, 'matchedName', matched.name)
              handleFieldChange(record.key, 'action', 'update')
            } else {
              handleFieldChange(record.key, 'matched', null)
              handleFieldChange(record.key, 'matchedName', null)
              handleFieldChange(record.key, 'action', 'create')
            }
          }}
          style={{ width: '100%' }}
          placeholder="选填"
        />
      )
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 70,
      render: (text: number, record: any) => (
        <InputNumber
          size="small"
          value={text || undefined}
          onChange={(value: number | null) => handleFieldChange(record.key, 'quantity', value || 0)}
          style={{ width: '100%' }}
          min={0}
        />
      )
    },
    {
      title: '成本',
      dataIndex: 'costPrice',
      width: 70,
      render: (text: number, record: any) => (
        <InputNumber
          size="small"
          value={text || undefined}
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
      width: 70,
      render: (text: number, record: any) => (
        <InputNumber
          size="small"
          value={text || undefined}
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
      width: 80,
      render: (text: number) => text > 0 ? text.toLocaleString() : '-'
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 70,
      render: (text: string, record: any) => (
        <select
          value={text}
          onChange={(e) => handleActionChange(record.key, e.target.value as any)}
          style={{ padding: 3, borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 11, width: '100%' }}
        >
          <option value="create">新建</option>
          <option value="update">更新</option>
          <option value="skip">跳过</option>
        </select>
      )
    },
    {
      title: '',
      width: 32,
      render: (_: any, record: any) => (
        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeRow(record.key)} />
      )
    }
  ]

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="📸 持仓识别"
      width={720}
      style={{ top: '10%' }}
      styles={{ body: { maxHeight: '60vh', overflow: 'auto', paddingTop: 12 } }}
      footer={[
        <Button key="back" onClick={onClose} size="small">取消</Button>,
        <Button key="import" type="primary" onClick={handleImport} disabled={dataSource.length === 0} size="small">
          确认导入{dataSource.filter(r => r.action !== 'skip').length > 0 ? `(${dataSource.filter(r => r.action !== 'skip').length})` : ''}
        </Button>
      ]}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 8, padding: '6px 10px', background: '#f6f8fa', borderRadius: 6, border: '1px solid #eaeef2' }}>
          <div style={{ fontSize: 12, color: '#57606a', lineHeight: 1.5 }}>
            <strong>提示：</strong>上传券商 APP 的持仓列表页面截图，系统自动识别为表格。
            <Tooltip title="建议截取持仓明细页面（显示每只股票的名称、现价），而非账户首页">
              <InfoCircleOutlined style={{ color: '#999', marginLeft: 4 }} />
            </Tooltip>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Upload
            beforeUpload={handleUpload}
            accept="image/*"
            showUploadList={false}
            disabled={uploading}
          >
            <Button icon={<UploadOutlined />} loading={uploading} type="primary" size="small">
              {uploading ? '识别中...' : '上传截图'}
            </Button>
          </Upload>
          <Button icon={<PlusOutlined />} onClick={addManualRow} size="small">
            手动添加
          </Button>
          <Button
            size="small"
            onClick={() => setShowRawText(!showRawText)}
          >
            {showRawText ? '隐藏原文' : '查看原文'}
          </Button>
        </div>
      </div>

      {parseError && dataSource.length === 0 && (
        <div style={{
          padding: '10px 12px',
          background: '#fff8f8',
          border: '1px solid #ffe5e5',
          borderRadius: 6,
          marginBottom: 10,
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          color: '#cf222e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <ExclamationCircleOutlined style={{ fontSize: 14 }} />
            <strong>识别未成功</strong>
          </div>
          {parseError}
        </div>
      )}

      {showRawText && rawText && (
        <div style={{ marginBottom: 10, padding: 8, background: '#f6f8fa', borderRadius: 6, maxHeight: 150, overflow: 'auto' }}>
          <div style={{ fontSize: 11, color: '#57606a', marginBottom: 4 }}>
            <strong>原始文本：</strong>
          </div>
          <pre style={{ fontSize: 11, color: '#666', whiteSpace: 'pre-wrap', margin: 0 }}>
            {rawText}
          </pre>
        </div>
      )}

      {dataSource.length > 0 && (
        <div>
          <div style={{
            marginBottom: 8,
            padding: '6px 10px',
            background: 'linear-gradient(135deg, rgba(26,127,55,0.08) 0%, rgba(26,127,55,0.04) 100%)',
            borderRadius: 6,
            borderLeft: '3px solid #1a7f37'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <strong style={{ color: '#1a7f37', fontSize: 12 }}>✅ 已识别 {dataSource.length} 条持仓</strong>
              <span style={{ color: '#57606a', fontSize: 12 }}>核对后点击导入</span>
              {ocrEngine && (
                <Tag color={engineTag.color} style={{ fontSize: 11 }}>{engineTag.text}</Tag>
              )}
            </div>
          </div>
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="small"
            bordered
            scroll={{ x: 680 }}
          />
        </div>
      )}

      {!uploading && dataSource.length === 0 && !parseError && (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: '#8c959f' }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>📷</div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>上传券商持仓截图开始识别</div>
          <div style={{ fontSize: 11, color: '#b1bac4' }}>
            支持 PNG/JPG · 或点击「手动添加」
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ScreenshotImportModal
