import React from 'react'
import { Button, App as AntApp } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { PositionTradeRecord } from '../types/note'
import { usePositionNotesStore } from '../stores/positionNotesStore'
import { useIsMobile } from '../hooks/useMediaQuery'
import TradeRecordForm from './TradeRecordForm'
import { formatDateTime } from '../utils/dateFormat'

interface Props {
  holdingId: string
}

const TradeRecordTimeline: React.FC<Props> = ({ holdingId }) => {
  const isMobile = useIsMobile()
  const { trades, deleteTrade } = usePositionNotesStore()
  const [editingRecord, setEditingRecord] = React.useState<PositionTradeRecord | null>(null)
  const [formVisible, setFormVisible] = React.useState(false)
  const { message, modal } = AntApp.useApp()

  const records = trades
    .filter(t => t.holding_id === holdingId)
    .sort((a, b) => (b.record_time || '').localeCompare(a.record_time || ''))

  const handleAdd = () => {
    setEditingRecord(null)
    setFormVisible(true)
  }

  const handleEdit = (record: PositionTradeRecord) => {
    setEditingRecord(record)
    setFormVisible(true)
  }

  const handleDelete = (record: PositionTradeRecord) => {
    modal.confirm({
      title: '删除交易记录',
      content: '确认要删除这条交易记录吗？',
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await deleteTrade(record.id)
        message.success('已删除')
      }
    })
  }

  const handleSave = async (input: any) => {
    if (editingRecord) {
      const { updateTrade } = usePositionNotesStore.getState()
      await updateTrade(editingRecord.id, input)
    } else {
      const { createTrade } = usePositionNotesStore.getState()
      await createTrade(input)
    }
  }

  if (records.length === 0) {
    return (
      <>
        <div className="trade-timeline-empty">
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>📋</div>
          <div>还没有交易记录</div>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-tertiary)' }}>点击右上角添加</div>
        </div>
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size={isMobile ? 'large' : 'middle'}>
            追加交易记录
          </Button>
        </div>
        <TradeRecordForm
          visible={formVisible}
          onClose={() => setFormVisible(false)}
          onSave={handleSave}
          holdingId={holdingId}
          editRecord={editingRecord}
        />
      </>
    )
  }

  return (
    <>
      <div className="trade-timeline">
        {records.map((r) => (
          <div key={r.id} className={`trade-timeline-item ${r.action}`}>
            <span className="trade-timeline-dot" />
            <div className="trade-timeline-head">
              <span className="trade-timeline-time">
                {formatDateTime(r.record_time)}
              </span>
              <span className={`trade-timeline-action trade-timeline-action-${r.action}`}>
                {r.action === 'buy' ? '买入' : '卖出'}
              </span>
              <span className="trade-timeline-price num">
                {r.quantity}股 @ ¥{r.price.toFixed(2)}
              </span>
            </div>
            <div className="trade-timeline-reason">{r.reason}</div>
            {(r.target_price || r.stop_loss_price || r.holding_period) && (
              <div className="trade-timeline-chips">
                {r.target_price != null && (
                  <span className="trade-timeline-chip">目标 ¥{r.target_price.toFixed(2)}</span>
                )}
                {r.stop_loss_price != null && (
                  <span className="trade-timeline-chip">止损 ¥{r.stop_loss_price.toFixed(2)}</span>
                )}
                {r.holding_period && (
                  <span className="trade-timeline-chip">
                    {r.holding_period === 'short' ? '短线' : r.holding_period === 'mid' ? '中线' : '长线'}
                  </span>
                )}
              </div>
            )}
            {r.market_context && (
              <div className="trade-timeline-context">📌 {r.market_context}</div>
            )}
            <div className="trade-timeline-actions">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(r)}
              >
                编辑
              </Button>
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(r)}
              >
                删除
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size={isMobile ? 'large' : 'middle'}>
          追加交易记录
        </Button>
      </div>
      <TradeRecordForm
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onSave={handleSave}
        holdingId={holdingId}
        editRecord={editingRecord}
      />
    </>
  )
}

export default TradeRecordTimeline
