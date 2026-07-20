import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip, Segmented } from 'antd'
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  CheckSquareOutlined,
  CodeOutlined,
  BlockOutlined,
  LinkOutlined,
  PictureOutlined
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import { useIsMobile } from '../hooks/useMediaQuery'
import './BlockEditor.css'

export interface BlockEditorProps {
  value?: string
  onChange?: (markdown: string, plainText: string) => void
  placeholder?: string
  minHeight?: number
  showPreview?: boolean
  autoSave?: boolean
  onAutoSave?: (markdown: string, plainText: string) => void
  debounceMs?: number
}

/**
 * Markdown 块编辑器（桌面端 + 移动端）
 * - 桌面端：完整工具栏 + 编辑/预览切换
 * - 移动端：精简工具栏 + 横滑 + 始终可预览
 */
export const BlockEditor: React.FC<BlockEditorProps> = ({
  value = '',
  onChange,
  placeholder = '在这里写下你的想法…\n\n支持 Markdown 语法：\n# 标题\n- 列表\n**加粗** *斜体*\n`代码`\n> 引用',
  minHeight = 320,
  showPreview = true,
  autoSave = false,
  onAutoSave,
  debounceMs = 1500
}) => {
  const isMobile = useIsMobile()
  const [content, setContent] = useState(value)
  const [view, setView] = useState<'edit' | 'preview' | 'split'>(isMobile ? 'edit' : 'split')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setContent(value)
  }, [value])

  // 切换移动端视图模式
  useEffect(() => {
    if (isMobile && view === 'split') {
      setView('edit')
    }
  }, [isMobile, view])

  // 提取纯文本
  const plainText = useMemo(() => {
    return content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/!\[.*?\]\(.*?\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/[#>*_\-`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [content])

  // 自动保存
  useEffect(() => {
    if (!autoSave || !onAutoSave) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (isDirty) {
        onAutoSave(content, plainText)
        setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
        setIsDirty(false)
      }
    }, debounceMs)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [content, isDirty, autoSave, onAutoSave, debounceMs, plainText])

  // 通知父组件
  useEffect(() => {
    onChange?.(content, plainText)
  }, [content, plainText, onChange])

  const insert = (before: string, after: string = '', placeholderText: string = '') => {
    const ta = textareaRef.current
    if (!ta) {
      // 退化处理
      setContent(c => c + before + placeholderText + after)
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = ta.value.substring(start, end) || placeholderText
    const next = ta.value.substring(0, start) + before + selected + after + ta.value.substring(end)
    setContent(next)
    setIsDirty(true)
    // 恢复光标
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + before.length + selected.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const insertAtLineStart = (prefix: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setContent(c => prefix + c)
      return
    }
    const start = ta.selectionStart
    const before = ta.value.substring(0, start)
    const lastNewline = before.lastIndexOf('\n')
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1
    const next = ta.value.substring(0, lineStart) + prefix + ta.value.substring(lineStart)
    setContent(next)
    setIsDirty(true)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + prefix.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const tools = isMobile
    ? [
        { key: 'h', icon: <span className="block-editor-tool-text">H</span>, label: '标题', action: () => insertAtLineStart('## ') },
        { key: 'b', icon: <BoldOutlined />, label: '加粗', action: () => insert('**', '**', '加粗') },
        { key: 'i', icon: <ItalicOutlined />, label: '斜体', action: () => insert('*', '*', '斜体') },
        { key: 'ul', icon: <UnorderedListOutlined />, label: '无序列表', action: () => insertAtLineStart('- ') },
        { key: 'ol', icon: <OrderedListOutlined />, label: '有序列表', action: () => insertAtLineStart('1. ') },
        { key: 'check', icon: <CheckSquareOutlined />, label: '待办', action: () => insertAtLineStart('- [ ] ') },
        { key: 'quote', icon: <BlockOutlined />, label: '引用', action: () => insertAtLineStart('> ') },
        { key: 'code', icon: <CodeOutlined />, label: '代码', action: () => insert('`', '`', 'code') },
        { key: 'link', icon: <LinkOutlined />, label: '链接', action: () => insert('[', '](https://)', '文本') },
        { key: 'img', icon: <PictureOutlined />, label: '图片', action: () => insert('![', '](https://)', '描述') },
        { key: 'hr', icon: <span className="block-editor-tool-text">—</span>, label: '分隔线', action: () => insert('\n---\n') }
      ]
    : [
        { key: 'h1', icon: <span className="block-editor-tool-text">H1</span>, label: '一级标题', action: () => insertAtLineStart('# ') },
        { key: 'h2', icon: <span className="block-editor-tool-text">H2</span>, label: '二级标题', action: () => insertAtLineStart('## ') },
        { key: 'h3', icon: <span className="block-editor-tool-text">H3</span>, label: '三级标题', action: () => insertAtLineStart('### ') },
        { key: 'sep1', type: 'sep' as const },
        { key: 'b', icon: <BoldOutlined />, label: '加粗', action: () => insert('**', '**', '加粗') },
        { key: 'i', icon: <ItalicOutlined />, label: '斜体', action: () => insert('*', '*', '斜体') },
        { key: 'u', icon: <UnderlineOutlined />, label: '下划线', action: () => insert('<u>', '</u>', '下划线') },
        { key: 's', icon: <StrikethroughOutlined />, label: '删除线', action: () => insert('~~', '~~', '删除线') },
        { key: 'sep2', type: 'sep' as const },
        { key: 'ul', icon: <UnorderedListOutlined />, label: '无序列表', action: () => insertAtLineStart('- ') },
        { key: 'ol', icon: <OrderedListOutlined />, label: '有序列表', action: () => insertAtLineStart('1. ') },
        { key: 'check', icon: <CheckSquareOutlined />, label: '待办', action: () => insertAtLineStart('- [ ] ') },
        { key: 'quote', icon: <BlockOutlined />, label: '引用', action: () => insertAtLineStart('> ') },
        { key: 'code', icon: <CodeOutlined />, label: '代码', action: () => insert('`', '`', 'code') },
        { key: 'sep3', type: 'sep' as const },
        { key: 'link', icon: <LinkOutlined />, label: '链接', action: () => insert('[', '](https://)', '文本') },
        { key: 'img', icon: <PictureOutlined />, label: '图片', action: () => insert('![', '](https://)', '描述') },
        { key: 'hr', icon: <span className="block-editor-tool-text">—</span>, label: '分隔线', action: () => insert('\n---\n') }
      ]

  const renderEditArea = () => (
    <textarea
      ref={textareaRef}
      className="block-editor-textarea"
      value={content}
      onChange={(e) => { setContent(e.target.value); setIsDirty(true) }}
      placeholder={placeholder}
      style={{ minHeight }}
      spellCheck={false}
    />
  )

  const renderPreviewArea = () => (
    <div className="block-editor-preview" style={{ minHeight }}>
      {content.trim() ? (
        <ReactMarkdown>{content}</ReactMarkdown>
      ) : (
        <div className="block-editor-preview-empty">预览将显示在这里</div>
      )}
    </div>
  )

  return (
    <div className="block-editor" data-mobile={isMobile ? 'true' : 'false'}>
      <div className="block-editor-toolbar-scroll">
        <div className="block-editor-toolbar">
          {tools.map((tool, idx) => {
            if ('type' in tool && tool.type === 'sep') {
              return <span key={`sep-${idx}`} className="block-editor-tool-sep" />
            }
            const t = tool as any
            return (
              <Tooltip key={t.key} title={t.label} mouseEnterDelay={0.5}>
                <button
                  type="button"
                  className="block-editor-tool"
                  onClick={(e) => { e.preventDefault(); t.action() }}
                  aria-label={t.label}
                >
                  {t.icon}
                </button>
              </Tooltip>
            )
          })}
          {autoSave && (
            <span className="block-editor-save-indicator" aria-live="polite">
              {isDirty ? '编辑中…' : savedAt ? `已保存 ${savedAt}` : '自动保存已开启'}
            </span>
          )}
        </div>
      </div>

      {showPreview && !isMobile && (
        <div className="block-editor-view-toggle">
          <Segmented
            value={view}
            onChange={(v) => setView(v as any)}
            options={[
              { label: '编辑', value: 'edit' },
              { label: '分屏', value: 'split' },
              { label: '预览', value: 'preview' }
            ]}
            size="small"
          />
        </div>
      )}

      {showPreview && isMobile && (
        <div className="block-editor-view-toggle">
          <Segmented
            value={view}
            onChange={(v) => setView(v as any)}
            options={[
              { label: '编辑', value: 'edit' },
              { label: '预览', value: 'preview' }
            ]}
            size="small"
            block
          />
        </div>
      )}

      <div className={`block-editor-content block-editor-view-${view}`}>
        {(view === 'edit' || view === 'split') && renderEditArea()}
        {(view === 'preview' || view === 'split') && renderPreviewArea()}
      </div>
    </div>
  )
}

export default BlockEditor
