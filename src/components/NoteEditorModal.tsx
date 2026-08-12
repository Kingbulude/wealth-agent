import React, { useState } from 'react'
import { Modal, Drawer, Button, Input, Select, App as AntApp, Switch } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { NoteCategory, Note } from '../types/note'
import { useIsMobile } from '../hooks/useMediaQuery'
import BlockEditor from './BlockEditor'
import { Holding } from '../types/holding'

interface Props {
  visible: boolean
  onClose: () => void
  onSave: (input: Omit<Note, 'id' | 'user_email' | 'created_at' | 'updated_at' | 'is_pinned' | 'is_archived'>) => void
  category: NoteCategory
  holdings?: Holding[]
}

const CATEGORY_TITLES: Record<NoteCategory, string> = {
  cognition: '新建投资认知',
  trade: '新建交易记录笔记',
  review: '新建复盘笔记',
  learning: '新建学习资料笔记'
}

const NoteEditorModal: React.FC<Props> = ({ visible, onClose, onSave, category, holdings = [] }) => {
  const isMobile = useIsMobile()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [relatedHolding, setRelatedHolding] = useState<string | undefined>(undefined)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const { message } = AntApp.useApp()

  const reset = () => {
    setTitle('')
    setContent('')
    setTags('')
    setRelatedHolding(undefined)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSave = () => {
    if (!title.trim()) {
      message.warning('请填写标题')
      return
    }
    if (category === 'cognition' && !content.trim()) {
      message.warning('内容不能为空')
      return
    }
    const plainText = content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_\-`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    onSave({
      category,
      title: title.trim(),
      content_json: content,
      content_text: plainText,
      tags,
      related_holding_id: relatedHolding || null
    })
    reset()
    onClose()
  }

  const holdingOptions = holdings.map(h => ({
    value: h.id,
    label: `${h.name} (${h.symbol})`
  }))

  const editorBlock = (
    <BlockEditor
      value={content}
      onChange={(md) => setContent(md)}
      minHeight={isMobile ? 280 : 380}
      showPreview
      autoSave={autoSaveEnabled}
      onAutoSave={() => {}}
    />
  )

  if (isMobile) {
    return (
      <Drawer
        open={visible}
        onClose={handleClose}
        placement="bottom"
        height="100%"
        title={CATEGORY_TITLES[category]}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button block onClick={handleClose}>取消</Button>
            <Button block type="primary" onClick={handleSave}>保存</Button>
          </div>
        }
        styles={{ body: { padding: 0, overflow: 'auto' } }}
      >
        <div className="notes-mobile-editor">
          <input
            className="notes-mobile-editor-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="笔记标题…"
            style={{ marginLeft: 14, marginRight: 14 }}
          />
          <button
            className="notes-mobile-editor-meta-button"
            onClick={() => {
              Modal.info({
                title: '元数据',
                content: (
                  <div>
                    <div style={{ marginBottom: 8 }}>标签（逗号分隔）</div>
                    <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签" />
                  </div>
                ),
                onOk: () => {}
              })
            }}
          >
            <PlusOutlined /> 添加标签 / 关联持仓
          </button>
          {editorBlock}
        </div>
      </Drawer>
    )
  }

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      title={CATEGORY_TITLES[category]}
      width={760}
      className="notes-editor-modal"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            <Switch size="small" checked={autoSaveEnabled} onChange={setAutoSaveEnabled} /> 自动保存
          </span>
          <div style={{ flex: 1 }} />
          <Button onClick={handleClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </div>
      }
      destroyOnClose
    >
      <input
        className="notes-editor-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="笔记标题…"
      />
      {editorBlock}
      <div className="notes-editor-meta">
        <div className="notes-editor-meta-row">
          <span className="notes-editor-meta-label">标签</span>
          <Input
            size="small"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="多个标签用逗号分隔，例如：价值投资, 长期持有"
            style={{ flex: 1, maxWidth: 360 }}
          />
        </div>
        <div className="notes-editor-meta-row">
          <span className="notes-editor-meta-label">关联持仓</span>
          <Select
            size="small"
            value={relatedHolding}
            onChange={setRelatedHolding}
            allowClear
            placeholder="可选：关联到持仓"
            style={{ minWidth: 200 }}
            options={holdingOptions}
          />
        </div>
      </div>
    </Modal>
  )
}

export default NoteEditorModal
