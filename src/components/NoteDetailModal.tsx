import React, { useState } from 'react'
import { Modal, Drawer, Button, Input, App as AntApp } from 'antd'
import {
  PushpinOutlined,
  PushpinFilled,
  InboxOutlined,
  DeleteOutlined,
  EditOutlined,
  TagsOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import { Note } from '../types/note'
import { useIsMobile } from '../hooks/useMediaQuery'
import BlockEditor from './BlockEditor'
import { formatDateTime } from '../utils/dateFormat'

interface Props {
  note: Note
  visible: boolean
  onClose: () => void
  onUpdate: (patch: Partial<Note>) => void
  onDelete: () => void
}

const NoteDetailModal: React.FC<Props> = ({ note, visible, onClose, onUpdate, onDelete }) => {
  const isMobile = useIsMobile()
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [editContent, setEditContent] = useState(note.content_json)
  const [editTags, setEditTags] = useState(note.tags || '')
  const { message, modal } = AntApp.useApp()

  const startEdit = () => {
    setEditTitle(note.title)
    setEditContent(note.content_json)
    setEditTags(note.tags || '')
    setEditing(true)
  }

  const saveEdit = () => {
    if (!editTitle.trim()) {
      message.warning('标题不能为空')
      return
    }
    const plainText = editContent
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_\-`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    onUpdate({
      title: editTitle.trim(),
      content_json: editContent,
      content_text: plainText,
      tags: editTags
    })
    setEditing(false)
    message.success('已保存')
  }

  const handleDelete = () => {
    modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条笔记吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => { onDelete(); onClose() }
    })
  }

  const handleTogglePin = () => {
    onUpdate({ is_pinned: !note.is_pinned })
    message.success(note.is_pinned ? '已取消置顶' : '已置顶')
  }

  const handleArchive = () => {
    onUpdate({ is_archived: true })
    message.success('已归档')
    onClose()
  }

  const content = (
    <>
      {editing ? (
        <>
          <input
            className="notes-editor-title-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="笔记标题…"
          />
          <BlockEditor
            value={editContent}
            onChange={(md) => setEditContent(md)}
            minHeight={isMobile ? 280 : 380}
            showPreview
            autoSave={false}
          />
          <div className="notes-editor-meta">
            <div className="notes-editor-meta-row">
              <TagsOutlined style={{ color: 'var(--text-tertiary)' }} />
              <Input
                size="small"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="标签（逗号分隔）"
                style={{ maxWidth: 320 }}
              />
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '0 24px 24px' }}>
          <h2 className="notes-page-title" style={{ margin: '12px 0 16px' }}>
            {note.title || '（无标题）'}
          </h2>
          {note.tags && (
            <div className="notes-detail-tags">
              {note.tags.split(',').filter(Boolean).map((t) => (
                <span key={t} className="notes-card-tag">#{t.trim()}</span>
              ))}
            </div>
          )}
          <div className="block-editor-preview" style={{ minHeight: 200 }}>
            {note.content_text ? (
              <ReactMarkdown>{note.content_json || ''}</ReactMarkdown>
            ) : (
              <div className="block-editor-preview-empty">空笔记</div>
            )}
          </div>
          <div className="notes-detail-meta">
            <span><ClockCircleOutlined /> 创建于 {formatDateTime(note.created_at)}</span>
            <span>更新于 {formatDateTime(note.updated_at)}</span>
            {note.is_pinned ? <span style={{ color: 'var(--brand-500)' }}>📌 已置顶</span> : null}
          </div>
        </div>
      )}
    </>
  )

  const footer = editing
    ? [
        <Button key="cancel" onClick={() => setEditing(false)}>取消</Button>,
        <Button key="save" type="primary" onClick={saveEdit}>保存</Button>
      ]
    : [
        <Button key="pin" icon={note.is_pinned ? <PushpinFilled /> : <PushpinOutlined />} onClick={handleTogglePin}>
          {note.is_pinned ? '取消置顶' : '置顶'}
        </Button>,
        <Button key="archive" icon={<InboxOutlined />} onClick={handleArchive}>归档</Button>,
        <Button key="edit" type="primary" icon={<EditOutlined />} onClick={startEdit}>编辑</Button>,
        <Button key="del" danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
      ]

  if (isMobile) {
    return (
      <Drawer
        open={visible}
        onClose={onClose}
        placement="bottom"
        height="100%"
        title={editing ? '编辑笔记' : '笔记详情'}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            {editing ? (
              <>
                <Button block onClick={() => setEditing(false)}>取消</Button>
                <Button block type="primary" onClick={saveEdit}>保存</Button>
              </>
            ) : (
              <>
                <Button block icon={<EditOutlined />} onClick={startEdit}>编辑</Button>
                <Button block danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
              </>
            )}
          </div>
        }
        styles={{ body: { padding: 0, overflow: 'auto' } }}
      >
        {content}
      </Drawer>
    )
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={footer}
      width={760}
      title={editing ? '编辑笔记' : '笔记详情'}
      className="notes-editor-modal"
      destroyOnClose
    >
      {content}
    </Modal>
  )
}

export default NoteDetailModal
