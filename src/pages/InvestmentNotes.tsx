import React, { useState, useEffect, useMemo } from 'react'
import { Input, Button, App as AntApp, Modal, Form, Select } from 'antd'
import {
  PlusOutlined,
  BookOutlined,
  BulbOutlined,
  FileTextOutlined,
  LinkOutlined,
  EditOutlined,
  DeleteOutlined,
  PushpinFilled,
  ReloadOutlined,
  GlobalOutlined,
  ReadOutlined,
  PlayCircleOutlined,
  FilePdfOutlined
} from '@ant-design/icons'
import { useNotesStore } from '../stores/notesStore'
import { useLearningStore } from '../stores/learningStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useIsMobile } from '../hooks/useMediaQuery'
import type { Note, NoteCategory, NoteInput, LearningResource, LearningResourceInput, LearningResourceType } from '../types/note'
import NoteEditorModal from '../components/NoteEditorModal'
import NoteDetailModal from '../components/NoteDetailModal'
import { formatTime, formatMonthDay } from '../utils/dateFormat'
import './InvestmentNotes.css'

const CATEGORY_TABS: { key: NoteCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'cognition', label: '投资认知', icon: <BulbOutlined /> },
  { key: 'trade', label: '交易决策', icon: <FileTextOutlined /> },
  { key: 'review', label: '持仓复盘', icon: <BookOutlined /> },
  { key: 'learning', label: '学习资料', icon: <LinkOutlined /> }
]

const RESOURCE_TYPE_LABELS: Record<LearningResourceType, { label: string; icon: React.ReactNode }> = {
  report: { label: '研报', icon: <FilePdfOutlined /> },
  book: { label: '书籍', icon: <ReadOutlined /> },
  article: { label: '文章', icon: <FileTextOutlined /> },
  video: { label: '视频', icon: <PlayCircleOutlined /> },
  other: { label: '其他', icon: <GlobalOutlined /> }
}

const InvestmentNotes: React.FC = () => {
  const isMobile = useIsMobile()
  const { message, modal } = AntApp.useApp()
  const { notes, loading, loadNotes, createNote, updateNote, deleteNote, lastSyncAt } = useNotesStore()
  const { resources, loading: learningLoading, loadResources, create: createResource, update: updateResource, remove: removeResource } = useLearningStore()
  const { holdings } = useHoldingStore()

  const [activeCategory, setActiveCategory] = useState<NoteCategory>('cognition')
  const [searchQuery, setSearchQuery] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [detailNote, setDetailNote] = useState<Note | null>(null)
  const [resourceFormOpen, setResourceFormOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null)
  const [resourceTypeFilter, setResourceTypeFilter] = useState<LearningResourceType | 'all'>('all')
  const [resourceForm] = Form.useForm<LearningResourceInput>()

  useEffect(() => {
    loadNotes()
    loadResources()
  }, [loadNotes, loadResources])

  // 过滤当前分类的笔记
  const filteredNotes = useMemo(() => {
    let result = notes.filter(n => n.category === activeCategory && !n.is_archived)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content_text || '').toLowerCase().includes(q) ||
        (n.tags || '').toLowerCase().includes(q)
      )
    }
    return result.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      return (b.updated_at || '').localeCompare(a.updated_at || '')
    })
  }, [notes, activeCategory, searchQuery])

  const countByCategory = useMemo(() => {
    const c: Record<NoteCategory, number> = { cognition: 0, trade: 0, review: 0, learning: 0 }
    for (const n of notes) {
      if (!n.is_archived) c[n.category] = (c[n.category] || 0) + 1
    }
    return c
  }, [notes])

  const filteredResources = useMemo(() => {
    let result = resources
    if (resourceTypeFilter !== 'all') {
      result = result.filter(r => r.type === resourceTypeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.tags || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [resources, resourceTypeFilter, searchQuery])

  const handleCreateNote = async (input: NoteInput) => {
    await createNote(input)
    message.success('已创建笔记')
  }

  const handleUpdateNote = async (patch: Partial<Note>) => {
    if (!detailNote) return
    const pinRaw = patch.is_pinned
    const archRaw = patch.is_archived
    const fixed: Partial<NoteInput> = {
      ...patch,
      is_pinned: pinRaw === undefined ? undefined : (typeof pinRaw === 'number' ? Boolean(pinRaw) : pinRaw),
      is_archived: archRaw === undefined ? undefined : (typeof archRaw === 'number' ? Boolean(archRaw) : archRaw)
    }
    await updateNote(detailNote.id, fixed)
  }

  const handleDeleteNote = async () => {
    if (!detailNote) return
    await deleteNote(detailNote.id)
    message.success('已删除')
  }

  const handleOpenResource = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleEditResource = (r: LearningResource) => {
    setEditingResource(r)
    resourceForm.setFieldsValue({
      title: r.title,
      url: r.url,
      type: r.type,
      tags: r.tags,
      notes: r.notes
    })
    setResourceFormOpen(true)
  }

  const handleDeleteResource = (r: LearningResource) => {
    modal.confirm({
      title: '删除学习资料',
      content: `确认要删除「${r.title}」吗？`,
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        await removeResource(r.id)
        message.success('已删除')
      }
    })
  }

  const handleSubmitResource = async () => {
    try {
      const values = await resourceForm.validateFields()
      if (editingResource) {
        await updateResource(editingResource.id, values)
        message.success('已更新')
      } else {
        await createResource(values)
        message.success('已添加')
      }
      resourceForm.resetFields()
      setResourceFormOpen(false)
      setEditingResource(null)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '保存失败')
    }
  }

  const renderNoteCard = (n: Note) => {
    const tags = (n.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    return (
      <div
        key={n.id}
        className={`notes-card ${n.is_pinned ? 'pinned' : ''}`}
        onClick={() => setDetailNote(n)}
      >
        {n.is_pinned ? <PushpinFilled className="notes-card-pinned-flag" /> : null}
        <h3 className="notes-card-title">{n.title || '（无标题）'}</h3>
        <div className="notes-card-preview">
          {n.content_text || '空笔记'}
        </div>
        <div className="notes-card-footer">
          <div className="notes-card-tags">
            {tags.slice(0, 3).map(t => (
              <span key={t} className="notes-card-tag">#{t}</span>
            ))}
          </div>
          <span>{formatMonthDay(n.updated_at)}</span>
        </div>
      </div>
    )
  }

  const renderLearningCard = (r: LearningResource) => {
    const tags = (r.tags || '').split(',').map(t => t.trim()).filter(Boolean)
    return (
      <div
        key={r.id}
        className="learning-card"
        onClick={() => handleOpenResource(r.url)}
      >
        <span className={`learning-card-type learning-card-type-${r.type}`}>
          {RESOURCE_TYPE_LABELS[r.type]?.icon} {RESOURCE_TYPE_LABELS[r.type]?.label}
        </span>
        <h3 className="learning-card-title">{r.title}</h3>
        <div className="learning-card-url">{r.url}</div>
        {r.notes && <div className="learning-card-notes">{r.notes}</div>}
        <div className="learning-card-footer">
          <div className="notes-card-tags">
            {tags.slice(0, 3).map(t => (
              <span key={t} className="notes-card-tag">#{t}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditResource(r)}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteResource(r)}
            />
          </div>
        </div>
      </div>
    )
  }

  const renderCognitionList = () => {
    if (loading && notes.length === 0) {
      return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中…</div>
    }
    if (filteredNotes.length === 0) {
      return (
        <div className="notes-card-empty">
          <div className="notes-card-empty-icon">📝</div>
          <div style={{ marginBottom: 8 }}>还没有{searchQuery ? '匹配的' : ''}投资认知笔记</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditorOpen(true)}>
            新建第一篇笔记
          </Button>
        </div>
      )
    }
    return <div className="notes-card-grid">{filteredNotes.map(renderNoteCard)}</div>
  }

  const renderLearningList = () => {
    if (learningLoading && resources.length === 0) {
      return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中…</div>
    }
    if (filteredResources.length === 0) {
      return (
        <div className="notes-card-empty">
          <div className="notes-card-empty-icon">📚</div>
          <div style={{ marginBottom: 8 }}>还没有{searchQuery ? '匹配的' : ''}学习资料</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingResource(null)
            resourceForm.resetFields()
            resourceForm.setFieldsValue({ type: 'article' })
            setResourceFormOpen(true)
          }}>
            添加第一份资料
          </Button>
        </div>
      )
    }
    return <div className="notes-card-grid">{filteredResources.map(renderLearningCard)}</div>
  }

  // 交易决策/持仓复盘 - 提示用户去持仓管理页操作
  const renderGuideList = (kind: 'trade' | 'review') => {
    const isTrade = kind === 'trade'
    return (
      <div className="notes-card-empty">
        <div className="notes-card-empty-icon">{isTrade ? '💼' : '🔍'}</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          {isTrade ? '交易决策笔记' : '持仓复盘笔记'}
        </div>
        <div style={{ marginBottom: 16, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {isTrade
            ? '请前往「持仓管理」页，点击具体持仓中的「交易记录」按钮查看与追加买入/卖出决策。'
            : '请前往「持仓管理」页，点击具体持仓中的「复盘笔记」按钮查看与添加复盘。'}
        </div>
        <Button
          type="primary"
          onClick={() => {
            // 通过 location 切换 Tab
            const event = new CustomEvent('investment-notes:switch-tab', { detail: { tab: 'holdings' } })
            window.dispatchEvent(event)
          }}
        >
          前往持仓管理
        </Button>
      </div>
    )
  }

  return (
    <div className="notes-page">
      <div className="notes-page-header">
        <div>
          <div className="notes-page-subtitle">Notes &amp; Insights</div>
          <div className="notes-page-title">投资笔记</div>
        </div>
        <div className="notes-page-meta">
          {lastSyncAt && <span>已同步 · {formatTime(lastSyncAt)}</span>}
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => { loadNotes(); loadResources() }}
          >
            刷新
          </Button>
        </div>
      </div>

      <div className="notes-sub-tabs">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.key}
            className={`notes-sub-tab ${activeCategory === tab.key ? 'active' : ''}`}
            onClick={() => setActiveCategory(tab.key)}
          >
            {tab.icon}
            {tab.label}
            {tab.key !== 'learning' && countByCategory[tab.key] > 0 && (
              <span className="notes-sub-tab-count">{countByCategory[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="notes-toolbar">
        <Input.Search
          className="notes-search"
          placeholder={activeCategory === 'learning' ? '搜索资料…' : '搜索笔记标题、内容、标签…'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size={isMobile ? 'large' : 'middle'}
        />
        <div className="notes-action-bar">
          {activeCategory === 'cognition' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setEditorOpen(true)}
              size={isMobile ? 'large' : 'middle'}
            >
              新建笔记
            </Button>
          )}
          {activeCategory === 'learning' && (
            <>
              <Select
                value={resourceTypeFilter}
                onChange={setResourceTypeFilter}
                size={isMobile ? 'large' : 'middle'}
                style={{ minWidth: 100 }}
                options={[
                  { label: '全部类型', value: 'all' },
                  ...(Object.keys(RESOURCE_TYPE_LABELS) as LearningResourceType[]).map(t => ({
                    label: RESOURCE_TYPE_LABELS[t].label,
                    value: t
                  }))
                ]}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingResource(null)
                  resourceForm.resetFields()
                  resourceForm.setFieldsValue({ type: 'article' })
                  setResourceFormOpen(true)
                }}
                size={isMobile ? 'large' : 'middle'}
              >
                添加资料
              </Button>
            </>
          )}
        </div>
      </div>

      {activeCategory === 'cognition' && renderCognitionList()}
      {activeCategory === 'trade' && renderGuideList('trade')}
      {activeCategory === 'review' && renderGuideList('review')}
      {activeCategory === 'learning' && renderLearningList()}

      {/* 移动端浮动新建按钮 */}
      {isMobile && activeCategory === 'cognition' && (
        <button
          className="fab fab-fab"
          onClick={() => setEditorOpen(true)}
          aria-label="新建笔记"
        >
          <PlusOutlined />
        </button>
      )}
      {isMobile && activeCategory === 'learning' && (
        <button
          className="fab fab-fab"
          onClick={() => {
            setEditingResource(null)
            resourceForm.resetFields()
            resourceForm.setFieldsValue({ type: 'article' })
            setResourceFormOpen(true)
          }}
          aria-label="添加资料"
        >
          <PlusOutlined />
        </button>
      )}

      <NoteEditorModal
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleCreateNote}
        category={activeCategory}
        holdings={holdings}
      />

      {detailNote && (
        <NoteDetailModal
          note={detailNote}
          visible={!!detailNote}
          onClose={() => setDetailNote(null)}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
        />
      )}

      <Modal
        open={resourceFormOpen}
        onCancel={() => { setResourceFormOpen(false); setEditingResource(null) }}
        title={editingResource ? '编辑学习资料' : '添加学习资料'}
        onOk={handleSubmitResource}
        okText={editingResource ? '更新' : '添加'}
        cancelText="取消"
        width={isMobile ? '100vw' : 480}
        style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw' } : undefined}
        destroyOnClose
      >
        <Form form={resourceForm} layout="vertical" requiredMark="optional">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如：xxx 公司深度研报" />
          </Form.Item>
          <Form.Item name="url" label="链接" rules={[{ required: true, type: 'url', message: '请输入合法 URL' }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(RESOURCE_TYPE_LABELS) as LearningResourceType[]).map(t => ({
                label: RESOURCE_TYPE_LABELS[t].label,
                value: t
              }))}
            />
          </Form.Item>
          <Form.Item name="tags" label="标签（可选）">
            <Input placeholder="多个标签用逗号分隔" />
          </Form.Item>
          <Form.Item name="notes" label="备注（可选）">
            <Input.TextArea rows={3} maxLength={300} placeholder="简短描述或心得" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default InvestmentNotes
