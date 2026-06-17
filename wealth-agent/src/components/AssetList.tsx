import { useState, useEffect } from 'react'
import { Table, Button, Space, Tag, Popconfirm, message, Select, Card } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { Asset, AssetType, ASSET_TYPE_META } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import AddAssetModal from './AddAssetModal'

const { Option } = Select

export default function AssetList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editData, setEditData] = useState<Asset | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  
  const { loadAssets, deleteAsset, getAssetsByType } = useAssetStore()

  useEffect(() => {
    loadAssets()
  }, [])

  const filteredAssets = getAssetsByType(filterType)

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

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: AssetType) => {
        const meta = ASSET_TYPE_META[type]
        return (
          <Tag color={meta.color}>
            {meta.icon} {meta.label}
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
        <span style={{ color: record.type === 'debt' ? '#f5222d' : '#52c41a' }}>
          {record.type === 'debt' ? '-' : '+'}
          ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      title: '货币',
      dataIndex: 'currency',
      key: 'currency',
      width: 100,
      render: (currency: string) => currency
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
      title="我的资产"
      extra={
        <Space>
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 150 }}
          >
            <Option value="all">全部类型</Option>
            {Object.entries(ASSET_TYPE_META).map(([key, meta]) => (
              <Option key={key} value={key}>
                {meta.icon} {meta.label}
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