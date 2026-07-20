import React, { useState } from 'react'
import { Modal, Drawer, Form, Input, InputNumber, Radio, Button, App as AntApp } from 'antd'
import { PositionTradeRecordInput, PositionTradeRecord } from '../types/note'
import { useIsMobile } from '../hooks/useMediaQuery'

interface Props {
  visible: boolean
  onClose: () => void
  onSave: (input: PositionTradeRecordInput) => Promise<void>
  holdingId: string
  editRecord?: PositionTradeRecord | null
}

const TradeRecordForm: React.FC<Props> = ({ visible, onClose, onSave, holdingId, editRecord }) => {
  const isMobile = useIsMobile()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const { message } = AntApp.useApp()

  React.useEffect(() => {
    if (visible) {
      if (editRecord) {
        form.setFieldsValue({
          action: editRecord.action,
          price: editRecord.price,
          quantity: editRecord.quantity,
          reason: editRecord.reason,
          target_price: editRecord.target_price ?? undefined,
          stop_loss_price: editRecord.stop_loss_price ?? undefined,
          holding_period: editRecord.holding_period ?? undefined,
          market_context: editRecord.market_context ?? '',
          record_time: editRecord.record_time
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          action: 'buy',
          record_time: new Date().toISOString()
        })
      }
    }
  }, [visible, editRecord, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await onSave({
        id: editRecord?.id,
        holding_id: holdingId,
        action: values.action,
        price: Number(values.price),
        quantity: Number(values.quantity),
        reason: String(values.reason || '').trim(),
        target_price: values.target_price != null ? Number(values.target_price) : null,
        stop_loss_price: values.stop_loss_price != null ? Number(values.stop_loss_price) : null,
        holding_period: values.holding_period || null,
        market_context: values.market_context || null,
        record_time: values.record_time || new Date().toISOString()
      })
      form.resetFields()
      onClose()
      message.success(editRecord ? '已更新交易记录' : '已添加交易记录')
    } catch (e: any) {
      if (e?.errorFields) return  // 表单校验错误
      message.error(e?.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const formNode = (
    <Form form={form} layout="vertical" requiredMark="optional">
      <Form.Item name="action" label="操作类型" rules={[{ required: true }]}>
        <Radio.Group buttonStyle="solid" size={isMobile ? 'large' : 'middle'}>
          <Radio.Button value="buy">买入</Radio.Button>
          <Radio.Button value="sell">卖出</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: 12 }}>
        <Form.Item name="price" label="成交价" rules={[{ required: true, message: '请输入价格' }]}>
          <InputNumber prefix="¥" min={0} step={0.01} style={{ width: '100%' }} placeholder="价格" />
        </Form.Item>
        <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
          <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="数量" />
        </Form.Item>
      </div>

      <Form.Item name="reason" label="决策理由" rules={[{ required: true, message: '请填写决策理由' }]}>
        <Input.TextArea
          rows={isMobile ? 3 : 4}
          maxLength={500}
          showCount
          placeholder="为什么买入/卖出？基于什么判断？"
        />
      </Form.Item>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: 12 }}>
        <Form.Item name="target_price" label="目标价位（选填）">
          <InputNumber prefix="¥" min={0} step={0.01} style={{ width: '100%' }} placeholder="目标价" />
        </Form.Item>
        <Form.Item name="stop_loss_price" label="止损价位（选填）">
          <InputNumber prefix="¥" min={0} step={0.01} style={{ width: '100%' }} placeholder="止损价" />
        </Form.Item>
      </div>

      <Form.Item name="holding_period" label="持有周期">
        <Radio.Group size={isMobile ? 'large' : 'middle'}>
          <Radio.Button value="short">短线</Radio.Button>
          <Radio.Button value="mid">中线</Radio.Button>
          <Radio.Button value="long">长线</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item name="market_context" label="市场环境（选填）">
        <Input.TextArea
          rows={isMobile ? 2 : 3}
          maxLength={300}
          placeholder="记录当时的市场环境、宏观背景、行业事件等"
        />
      </Form.Item>
    </Form>
  )

  if (isMobile) {
    return (
      <Drawer
        open={visible}
        onClose={onClose}
        placement="bottom"
        height="92vh"
        title={editRecord ? '编辑交易记录' : '追加交易记录'}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button block onClick={onClose}>取消</Button>
            <Button block type="primary" loading={submitting} onClick={handleOk}>
              {editRecord ? '更新' : '添加'}
            </Button>
          </div>
        }
      >
        {formNode}
      </Drawer>
    )
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={editRecord ? '编辑交易记录' : '追加交易记录'}
      width={560}
      onOk={handleOk}
      confirmLoading={submitting}
      okText={editRecord ? '更新' : '添加'}
      cancelText="取消"
      destroyOnClose
    >
      {formNode}
    </Modal>
  )
}

export default TradeRecordForm
