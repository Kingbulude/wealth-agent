import { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, Radio, message } from 'antd'
import { ASSET_TYPE_META, CURRENCY_OPTIONS } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'

interface AddAssetModalProps {
  visible: boolean
  onClose: () => void
  editData?: any
}

export default function AddAssetModal({ visible, onClose, editData }: AddAssetModalProps) {
  const [form] = Form.useForm()
  const { addAsset, updateAsset } = useAssetStore()

  useEffect(() => {
    if (visible) {
      if (editData) {
        form.setFieldsValue(editData)
      } else {
        form.resetFields()
        form.setFieldsValue({
          type: 'cash',
          currency: 'CNY'
        })
      }
    }
  }, [visible, editData, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (editData) {
        await updateAsset(editData.id, values)
        message.success('资产更新成功')
      } else {
        await addAsset(values)
        message.success('资产添加成功')
      }
      
      onClose()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  return (
    <Modal
      title={editData ? '编辑资产' : '添加资产'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      okText={editData ? '保存' : '添加'}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          type: 'cash',
          currency: 'CNY'
        }}
      >
        <Form.Item
          name="type"
          label="资产类型"
          rules={[{ required: true, message: '请选择资产类型' }]}
        >
          <Radio.Group buttonStyle="solid">
            {Object.entries(ASSET_TYPE_META).map(([key, meta]) => (
              <Radio.Button key={key} value={key}>
                {meta.icon} {meta.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="name"
          label="资产名称"
          rules={[{ required: true, message: '请输入资产名称' }]}
        >
          <Input placeholder="例如：招商银行活期存款" />
        </Form.Item>

        <Form.Item
          name="amount"
          label="金额（元）"
          rules={[
            { required: true, message: '请输入金额' },
            { type: 'number', min: 0, message: '金额不能为负' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            precision={2}
            placeholder="请输入金额"
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          />
        </Form.Item>

        <Form.Item
          name="currency"
          label="货币"
          rules={[{ required: true, message: '请选择货币类型' }]}
        >
          <Select options={CURRENCY_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="description"
          label="备注（可选）"
        >
          <Input.TextArea rows={2} placeholder="添加一些备注信息" />
        </Form.Item>
      </Form>
    </Modal>
  )
}