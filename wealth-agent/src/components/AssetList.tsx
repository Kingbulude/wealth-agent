import { useState, useEffect } from 'react'
import { Table, Button, Space, Tag, Popconfirm, message, Select, Card } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  Asset,
  AssetCategory,
  ASSET_CATEGORY_META,
  ASSET_SUBTYPE_META
} from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import AddAssetModal from './AddAssetModal'

const { Option } = Select

export default function AssetList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editData, setEditData] = useState<Asset | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const { loadAssets, deleteAsset, getAssetsByCategory, customTypes } = useAssetStore()

  useEffect(() => {
    loadAssets()
  }, [])

  const filteredAssets = getAssetsByCategory(filterCategory)

  const handleEdit = (record: Asset) => {
    setEditData(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    await deleteAsset(id)
    message.success('删除成功')
  }

  const handleModalClose = () => {
    setModalVisible(false)
    setEditData(null)
  }

  const getTypeLabel = (asset: Asset) => {
    // 先尝试从标准类型获取
    const standardMeta = ASSET_SUBTYPE_META[asset.type]
    if (standardMeta) {
      return {
        icon: standardMeta.icon,
        label: standardMeta.label,
        color: ASSET_CATEGORY_META[standardMeta.category]?.color || '#666'
      }
    }

    // 再尝试从自定义类型获取
    const customMeta = customTypes.find(ct => ct.type === asset.type)
    if (customMeta) {
      return {
        icon: '✨',
        label: customMeta.name,
        color: ASSET_CATEGORY_META[customMeta.category]?.color || '#666'
      }
    }

    return {
      icon: '📦',
      label: asset.type,
      color: '#666'
    }
  }

  const columns = [
    {
      title: '大类',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (category: AssetCategory) => {
        const meta = ASSET_CATEGORY_META[category]
        if (!meta) {
          return <Tag>{category || '未分类'}</Tag>
        }
        return (
          <Tag color={meta.color}>
            {meta.icon} {meta.label.split(' ')[1]}
          </Tag>
        )
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (_: any, record: Asset) => {
        const typeInfo = getTypeLabel(record)
        return (
          <Tag>
            {typeInfo.icon} {typeInfo.label}
          </Tag>
        )
      }
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (amount: number, record: Asset) => (
        <span style={{ color: record.category === 'debt' ? '#f5222d' : '#52c41a' }}>
          {record.category === 'debt' ? '-' : '+'}
          ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      title: '货币',
      dataIndex: 'currency',
      key: 'currency',
      width: 100,
      render: (currency: string) => {
        const currencyMap: Record<string, string> = {
          CNY: '🇨🇳 CNY',
          USD: '🇺🇸 USD',
          EUR: '🇪🇺 EUR',
          HKD: '🇭🇰 HKD',
          JPY: '🇯🇵 JPY'
        }
        return currencyMap[currency] || currency
      }
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Asset) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条资产吗？"
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
            onClick={() => setModalVisible(true)}
          >
            添加资产
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={filteredAssets}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '暂无资产，点击上方按钮添加' }}
      />

      <AddAssetModal
        visible={modalVisible}
        onClose={handleModalClose}
        editData={editData}
      />
    </Card>
  )
}
