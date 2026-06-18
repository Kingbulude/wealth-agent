import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, Tabs, Button, message } from 'antd'
import {
  ASSET_CATEGORY_META,
  ASSET_SUBTYPE_META,
  CURRENCY_OPTIONS,
  getSubtypesByCategory,
  AssetCategory,
  AssetSubType
} from '../types/asset'
import { useAssetStore } from '../stores/assetStore'

interface AddAssetModalProps {
  visible: boolean
  onClose: () => void
  editData?: any
}

export default function AddAssetModal({ visible, onClose, editData }: AddAssetModalProps) {
  const [form] = Form.useForm()
  const { addAsset, updateAsset, customTypes, addCustomType } = useAssetStore()
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null)
  const [addCustomVisible, setAddCustomVisible] = useState(false)
  const [customTypeName, setCustomTypeName] = useState('')
  const [customTypeCategory, setCustomTypeCategory] = useState<AssetCategory>('cash')

  useEffect(() => {
    if (visible) {
      if (editData) {
        form.setFieldsValue({
          category: editData.category,
          type: editData.type,
          name: editData.name,
          amount: editData.amount,
          currency: editData.currency,
          description: editData.description
        })
        setSelectedCategory(editData.category)
      } else {
        form.resetFields()
        form.setFieldsValue({
          currency: 'CNY'
        })
        setSelectedCategory(null)
      }
    }
  }, [visible, editData, form])

  const handleCategoryChange = (category: AssetCategory) => {
    setSelectedCategory(category)
    form.setFieldsValue({ type: undefined }) // 清空子类型选择
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (!values.category) {
        message.error('请选择资产大类')
        return
      }
      if (!values.type) {
        message.error('请选择资产类型')
        return
      }

      const assetData = {
        category: values.category,
        type: values.type,
        name: values.name,
        amount: values.amount,
        currency: values.currency,
        description: values.description
      }

      if (editData) {
        await updateAsset(editData.id, assetData)
        message.success('资产更新成功')
      } else {
        await addAsset(assetData)
        message.success('资产添加成功')
      }

      onClose()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  const handleAddCustomType = () => {
    if (!customTypeName.trim()) {
      message.error('请输入类型名称')
      return
    }

    const customKey = `custom_${Date.now()}` as AssetSubType
    addCustomType(customKey, customTypeName, customTypeCategory)

    // 自动选中新添加的类型
    form.setFieldsValue({ type: customKey })
    setAddCustomVisible(false)
    setCustomTypeName('')
    message.success('自定义类型添加成功')
  }

  const getCategoryOptions = () => {
    return Object.entries(ASSET_CATEGORY_META).map(([key, meta]) => ({
      key,
      label: (
        <div style={{ padding: '8px 0' }}>
          <span style={{ fontSize: 18, marginRight: 8 }}>{meta.icon}</span>
          <span>{meta.label.split(' ')[1]}</span>
        </div>
      ),
      value: key
    }))
  }

  const getSubtypeOptions = () => {
    if (!selectedCategory) return []

    const subtypes = getSubtypesByCategory(selectedCategory as AssetCategory)
    const options = subtypes.map(key => {
      const meta = ASSET_SUBTYPE_META[key]
      return {
        label: (
          <span>
            <span style={{ marginRight: 8 }}>{meta.icon}</span>
            {meta.label}
          </span>
        ),
        value: key
      }
    })

    // 添加自定义类型
    const customOptions = customTypes
      .filter(ct => ct.category === selectedCategory)
      .map(ct => ({
        label: (
          <span>
            <span style={{ marginRight: 8 }}>✨</span>
            {ct.name}
          </span>
        ),
        value: ct.type
      }))

    return [...options, ...customOptions]
  }

  const categoryTabItems = Object.entries(ASSET_CATEGORY_META).map(([key, meta]) => ({
    key,
    label: (
      <div style={{ textAlign: 'center', padding: '4px 8px' }}>
        <div style={{ fontSize: 20 }}>{meta.icon}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{meta.label.split(' ')[1]}</div>
      </div>
    ),
    children: (
      <div style={{ padding: '16px 0' }}>
        <div style={{ marginBottom: 16, color: '#666' }}>
          {meta.label} 包含以下类型：
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {getSubtypesByCategory(key as AssetCategory).map(subKey => {
            const subMeta = ASSET_SUBTYPE_META[subKey]
            return (
              <div
                key={subKey}
                style={{
                  padding: '8px 16px',
                  background: '#f5f5f5',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span>{subMeta.icon}</span>
                <span>{subMeta.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }))

  return (
    <>
      <Modal
        title={editData ? '📝 编辑资产' : '➕ 添加资产'}
        open={visible}
        onOk={handleSubmit}
        onCancel={onClose}
        okText={editData ? '保存' : '添加'}
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            currency: 'CNY'
          }}
        >
          {/* 资产大类选择 */}
          <Form.Item
            name="category"
            label="资产大类"
            rules={[{ required: true, message: '请选择资产大类' }]}
          >
            <Select
              placeholder="请选择资产大类"
              options={getCategoryOptions()}
              onChange={handleCategoryChange}
              optionRender={(option) => option.data.label}
              style={{ width: '100%' }}
            />
          </Form.Item>

          {/* 子类型选择 */}
          {selectedCategory && (
            <Form.Item
              name="type"
              label="资产类型"
              rules={[{ required: true, message: '请选择资产类型' }]}
              extra={
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    setCustomTypeCategory(selectedCategory as AssetCategory)
                    setAddCustomVisible(true)
                  }}
                  style={{ padding: 0 }}
                >
                  + 添加自定义类型
                </Button>
              }
            >
              <Select
                placeholder="请选择资产类型"
                options={getSubtypeOptions()}
                optionRender={(option) => option.data.label}
                disabled={!selectedCategory}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}

          {/* 类型预览 */}
          {selectedCategory && (
            <Tabs
              items={categoryTabItems}
              size="small"
              style={{ marginBottom: 16, background: '#fafafa', padding: 8, borderRadius: 8 }}
            />
          )}

          {/* 资产名称 */}
          <Form.Item
            name="name"
            label="资产名称"
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input placeholder="例如：招商银行活期存款、茅台股票" />
          </Form.Item>

          {/* 金额 */}
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

          {/* 货币 */}
          <Form.Item
            name="currency"
            label="货币"
            rules={[{ required: true, message: '请选择货币类型' }]}
          >
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>

          {/* 备注 */}
          <Form.Item
            name="description"
            label="备注（可选）"
          >
            <Input.TextArea rows={2} placeholder="添加一些备注信息，如：银行名称、投资目的等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加自定义类型弹窗 */}
      <Modal
        title="✨ 添加自定义类型"
        open={addCustomVisible}
        onOk={handleAddCustomType}
        onCancel={() => {
          setAddCustomVisible(false)
          setCustomTypeName('')
        }}
        okText="添加"
        cancelText="取消"
        width={400}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              类型名称
            </label>
            <Input
              placeholder="请输入自定义类型名称"
              value={customTypeName}
              onChange={e => setCustomTypeName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              归属大类
            </label>
            <Select
              style={{ width: '100%' }}
              value={customTypeCategory}
              onChange={setCustomTypeCategory}
              options={getCategoryOptions()}
              optionRender={(option) => option.data.label}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
