// 持仓智研页
// 设计风格：Modern Wealth Terminal
// 特点：双栏对话（历史 + 当前会话）、快捷场景、智能体上下文
// 功能：SSE 流式输出 + 工具调用状态实时显示

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Input, Button, Empty, Spin, Tooltip, message as antdMessage
} from 'antd'
import {
  SendOutlined, RobotOutlined, PlusOutlined,
  DeleteOutlined, ThunderboltOutlined,
  StopOutlined, HistoryOutlined, MenuOutlined, CloseOutlined,
  FundOutlined
} from '@ant-design/icons'
import {
  chat, ChatMessage, ChatSession,
  PRO_SCENARIO_TEMPLATES, ProScenarioTemplate,
  loadHistoryFromApi, saveHistoryToApi, getLocalHistory, saveLocalHistory,
  buildFinancialContext
} from '../services/aiService'
import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAuthStore } from '../renderer/stores/authStore'

const { TextArea } = Input

// 工具调用状态类型
interface ToolCallStatus {
  tool: string
  label: string
  status: 'running' | 'completed' | 'error'
  data?: any
}

// 渲染工具调用状态和内容（生成带 HTML 标记的字符串）
function renderToolCallsAndContent(toolCalls: ToolCallStatus[], content: string): string {
  const runningTools = toolCalls.filter(t => t.status === 'running')
  const completedTools = toolCalls.filter(t => t.status === 'completed')
  const errorTools = toolCalls.filter(t => t.status === 'error')

  let result = ''

  if (toolCalls.length > 0) {
    result += '\n\n<div class="tool-calls-container">'
    
    for (const t of runningTools) {
      result += `\n<div class="tool-call-item running">
        <span class="tool-call-icon">⏳</span>
        <span class="tool-call-label">${t.label}</span>
      </div>`
    }

    for (const t of completedTools) {
      result += `\n<div class="tool-call-item completed">
        <span class="tool-call-icon">✅</span>
        <span class="tool-call-label">${t.label}</span>
      </div>`
    }

    for (const t of errorTools) {
      result += `\n<div class="tool-call-item error">
        <span class="tool-call-icon">⚠️</span>
        <span class="tool-call-label">${t.label}</span>
      </div>`
    }

    result += '\n</div>'
  }

  if (content) {
    result += '\n\n' + content
  }

  return result
}

// 更新占位消息
function updatePlaceholderMessage(
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
  _sessionsList: ChatSession[],
  sessionId: string,
  timestamp: number,
  content: string
) {
  setSessions(prev => {
    const newSessions = [...prev]
    const sessionIdx = newSessions.findIndex(s => s.id === sessionId)
    if (sessionIdx === -1) return prev

    const msgIdx = newSessions[sessionIdx].messages.findIndex(m => m.role === 'assistant' && m.ts === timestamp)
    if (msgIdx === -1) return prev

    newSessions[sessionIdx] = {
      ...newSessions[sessionIdx],
      messages: newSessions[sessionIdx].messages.map((m, i) => 
        i === msgIdx ? { ...m, content } : m
      )
    }
    return newSessions
  })
}

export default function AIAdvisor() {
  const { assets, loadAssets } = useAssetStore()
  const { holdings, loadHoldings } = useHoldingStore()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeScenario, setActiveScenario] = useState<ProScenarioTemplate | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // 用于 SSE 流式更新
  const toolCallsRef = useRef<ToolCallStatus[]>([])
  const sessionsRef = useRef<ChatSession[]>(sessions)
  sessionsRef.current = sessions

  useEffect(() => {
    loadAssets()
    loadHoldings()
  }, [])

  // 加载历史
  useEffect(() => {
    (async () => {
      const apiSessions = await loadHistoryFromApi()
      const list = apiSessions || getLocalHistory()
      if (list.length > 0) {
        setSessions(list)
        setCurrentSessionId(list[0].id)
      } else {
        createNewSession()
      }
    })()
  }, [])

  // 滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentSessionId, sessions, loading])

  const currentSession = sessions.find(s => s.id === currentSessionId)

  // 智能体上下文
  const context = useMemo(() => {
    const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0)
    const totalHoldings = holdings.length
    return { totalAssets, totalHoldings, assetsCount: assets.length }
  }, [assets, holdings])

  function createNewSession() {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: '新对话',
      messages: [
        {
          role: 'assistant',
          content: `👋 你好！我是你的 **AI 财富顾问**。

我可以基于你的**实际持仓和资产**（${context.assetsCount} 个资产 / ${context.totalHoldings} 个持仓）给出专业建议。

试试左侧的专业分析场景，或直接提问：`,
          ts: Date.now()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const updated = [newSession, ...sessions]
    setSessions(updated)
    setCurrentSessionId(newSession.id)
    saveLocalHistory(updated)
    saveHistoryToApi(updated)
  }

  function deleteSession(id: string) {
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    if (currentSessionId === id) {
      setCurrentSessionId(updated[0]?.id || '')
      if (updated.length === 0) createNewSession()
    }
    saveLocalHistory(updated)
    saveHistoryToApi(updated)
  }

  // SSE 流式对话（带降级方案）
  async function sendMessage(text: string, skill?: ProScenarioTemplate) {
    const hasContent = text.trim() || skill
    if (!hasContent || loading || !currentSession) return

    let finalContent = text
    let isProScenario = false

    if (skill) {
      isProScenario = true
      const userQuery = text.trim() ? `\n\n用户问题：${text.trim()}` : '\n\n请基于我的实际持仓和资产数据进行分析。'
      finalContent = `【${skill.title}】\n\n${skill.prompt}${userQuery}`
    }

    const userMsg: ChatMessage = { role: 'user', content: finalContent, ts: Date.now() }
    const session = { ...currentSession, messages: [...currentSession.messages, userMsg] }
    if (session.title === '新对话' && currentSession.messages.length <= 1) {
      session.title = (skill ? skill.title + '：' : '') + (text.trim() || '专业分析').slice(0, 20) + ((text.trim() || '专业分析').length > 20 ? '...' : '')
    }
    session.updatedAt = new Date().toISOString()

    const updatedSessions = sessions.map(s => s.id === session.id ? session : s)
    setSessions(updatedSessions)
    setInput('')
    setActiveScenario(null)
    setLoading(true)

    // 重置工具调用状态
    toolCallsRef.current = []

    // 添加空的消息占位
    const placeholderMsg: ChatMessage = { role: 'assistant', content: '⏳ 正在准备分析...', ts: Date.now() }
    const sessionWithPlaceholder = {
      ...session,
      messages: [...session.messages, placeholderMsg]
    }
    const updatedSessionsWithPlaceholder = updatedSessions.map(s => s.id === session.id ? sessionWithPlaceholder : s)
    setSessions(updatedSessionsWithPlaceholder)

    try {
      // 尝试 SSE 流式接口
      const ctx = isProScenario ? buildFinancialContext() : undefined
      const query = encodeURIComponent(finalContent)
      const contextParam = ctx ? `&context=${encodeURIComponent(ctx)}` : ''
      
      // 注意：Cloudflare Pages Functions 路由是文件名直接映射
      // stock-analysis-stream.ts → /api/ai/stock-analysis-stream
      const token = useAuthStore.getState().token
      const response = await fetch(`/api/ai/stock-analysis-stream?query=${query}${contextParam}`, {
        headers: { Authorization: `Bearer ${token || ''}` }
      })

      if (!response.ok) {
        throw new Error(`SSE 请求失败: ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        throw new Error('响应不是 SSE 流')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()
      let buffer = ''
      let assistantContent = ''
      let receivedAnyData = false
      let currentEvent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
            continue
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              receivedAnyData = true

              if (data.error) {
                throw new Error(data.error || '服务端错误')
              }

              if (currentEvent === 'tool_start' || data.tool) {
                const tool = data.tool || 'unknown'
                const label = data.label || tool
                toolCallsRef.current.push({
                  tool,
                  label,
                  status: 'running' as const
                })
                assistantContent = renderToolCallsAndContent(toolCallsRef.current, '')
                updatePlaceholderMessage(setSessions, updatedSessionsWithPlaceholder, session.id, placeholderMsg.ts || Date.now(), assistantContent)
                currentEvent = ''
                continue
              }

              if (currentEvent === 'tool_end' || (data.tool && (data.status === 'completed' || data.status === 'error'))) {
                const tool = data.tool || 'unknown'
                const idx = toolCallsRef.current.findIndex(t => t.tool === tool && t.status === 'running')
                if (idx !== -1) {
                  toolCallsRef.current[idx] = {
                    tool,
                    label: data.label || tool,
                    status: data.status === 'completed' ? 'completed' : 'error',
                    data: data.data
                  }
                }
                assistantContent = renderToolCallsAndContent(toolCallsRef.current, '')
                updatePlaceholderMessage(setSessions, updatedSessionsWithPlaceholder, session.id, placeholderMsg.ts || Date.now(), assistantContent)
                currentEvent = ''
                continue
              }

              if (currentEvent === 'token' || (data.content !== undefined && currentEvent !== 'done')) {
                const tokenContent = data.content || ''
                assistantContent = renderToolCallsAndContent(toolCallsRef.current, assistantContent + tokenContent)
                updatePlaceholderMessage(setSessions, updatedSessionsWithPlaceholder, session.id, placeholderMsg.ts || Date.now(), assistantContent)
                currentEvent = ''
                continue
              }

              if (currentEvent === 'done' || data.reply !== undefined) {
                const finalReply = data.reply || ''
                if (finalReply && assistantContent.length < 20) {
                  assistantContent = renderToolCallsAndContent(toolCallsRef.current, finalReply)
                }
                updatePlaceholderMessage(setSessions, updatedSessionsWithPlaceholder, session.id, placeholderMsg.ts || Date.now(), assistantContent)
                currentEvent = ''
              }

              if (currentEvent === 'error' || data.message) {
                const errMsg = data.message || '分析出错'
                assistantContent = renderToolCallsAndContent(toolCallsRef.current, `❌ ${errMsg}`)
                updatePlaceholderMessage(setSessions, updatedSessionsWithPlaceholder, session.id, placeholderMsg.ts || Date.now(), assistantContent)
                currentEvent = ''
              }
            } catch (e) {
              console.warn('[SSE] 解析错误:', e)
            }
          } else {
            currentEvent = ''
          }
        }
      }

      if (!receivedAnyData) {
        throw new Error('SSE 未返回任何数据')
      }

      // 最终保存
      const finalMsg: ChatMessage = { role: 'assistant', content: assistantContent, ts: Date.now() }
      const finalSessionObj = {
        ...session,
        messages: [...session.messages, finalMsg],
        updatedAt: new Date().toISOString()
      }
      const finalSessionsList = updatedSessions.map(s => s.id === session.id ? finalSessionObj : s)
      setSessions(finalSessionsList)
      saveLocalHistory(finalSessionsList)
      saveHistoryToApi(finalSessionsList)

    } catch (sseError: any) {
      console.warn('[SSE] 流式接口失败，降级到普通接口:', sseError.message)
      
      // SSE 失败，降级到原有 chat 接口
      try {
        const ctx = isProScenario ? buildFinancialContext() : undefined
        const { reply } = await chat(
          session.messages.map(m => ({ role: m.role, content: m.content })),
          { context: ctx }
        )
        const assistantMsg: ChatMessage = { role: 'assistant', content: reply, ts: Date.now() }
        const finalSessionObj = {
          ...session,
          messages: [...session.messages, assistantMsg],
          updatedAt: new Date().toISOString()
        }
        const finalSessionsList = updatedSessions.map(s => s.id === session.id ? finalSessionObj : s)
        setSessions(finalSessionsList)
        saveLocalHistory(finalSessionsList)
        saveHistoryToApi(finalSessionsList)
      } catch (fallbackError: any) {
        const errorMsg: ChatMessage = { 
          role: 'assistant', 
          content: `⚠️ 调用失败：${fallbackError.message || fallbackError}`, 
          ts: Date.now() 
        }
        const errorSession = {
          ...session,
          messages: [...session.messages, errorMsg],
          updatedAt: new Date().toISOString()
        }
        const errorSessions = updatedSessions.map(s => s.id === session.id ? errorSession : s)
        setSessions(errorSessions)
        antdMessage.error('调用失败：' + (fallbackError.message || fallbackError))
      }
    } finally {
      setLoading(false)
    }
  }

  function handleProScenario(scenario: ProScenarioTemplate) {
    setActiveScenario(scenario)
  }

  // 解析结构化内容
  function renderStructuredContent(content: string) {
    const lines = content.split('\n')
    const elements: JSX.Element[] = []
    let listItems: string[] = []
    let inDataSection = false

    function flushList() {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="structured-list">
            {listItems.map((item, i) => (
              <li key={i}>{renderInlineBold(item)}</li>
            ))}
          </ul>
        )
        listItems = []
      }
    }

    function renderInlineBold(text: string) {
      const parts = text.split(/(\*\*[^*]+\*\*)/g)
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part}</span>
      })
    }

    lines.forEach((line, idx) => {
      const trimmed = line.trim()

      if (trimmed.startsWith('## ')) {
        flushList()
        inDataSection = trimmed.includes('数据引用') || trimmed.includes('数据')
        elements.push(
          <div key={`h2-${idx}`} className={`structured-section ${inDataSection ? 'data-section' : ''}`}>
            <div className="structured-section-title">
              {inDataSection && <span className="data-badge">📊 数据</span>}
              {trimmed.replace(/^##\s+/, '')}
            </div>
          </div>
        )
        return
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        listItems.push(trimmed.replace(/^[-•]\s+/, ''))
        return
      }

      if (trimmed === '') {
        flushList()
        return
      }

      flushList()
      elements.push(
        <p key={`p-${idx}`} className="structured-paragraph">
          {renderInlineBold(trimmed)}
        </p>
      )
    })

    flushList()
    return <div className="structured-content">{elements}</div>
  }

  // 简单的 markdown 渲染
  function renderContent(content: string) {
    const isStructured = /^##\s/.test(content.trim()) || content.includes('## 一、')
    if (isStructured) {
      return renderStructuredContent(content)
    }
    const parts = content.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  // 消息内容渲染（支持工具调用状态）
  function renderMessageContent(content: string) {
    if (!content) return null

    const hasToolCalls = content.includes('tool-calls-container') || 
                         content.includes('⏳') || 
                         content.includes('✅') ||
                         content.includes('⚠️')

    if (!hasToolCalls) {
      return renderContent(content)
    }

    // 解析工具调用
    const toolCallRegex = /<div class="tool-call-item ([^"]+)">\s*<span[^>]*>([^<]*)<\/span>\s*<span[^>]*>([^<]*)<\/span>\s*<\/div>/g
    const toolCalls: { type: string; icon: string; label: string }[] = []
    let match
    while ((match = toolCallRegex.exec(content)) !== null) {
      toolCalls.push({ type: match[1], icon: match[2], label: match[3] })
    }

    // 提取纯文本内容
    let textContent = content
      .replace(/<div class="tool-calls-container">[\s\S]*?<\/div>\s*<\/div>/g, '')
      .replace(/<div class="ai-message-bubble">/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()

    return (
      <>
        {toolCalls.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {toolCalls.map((t, i) => (
              <div
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  background: t.type === 'running' ? 'rgba(251, 191, 36, 0.1)' : 
                             t.type === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: t.type === 'running' ? '#b45309' : 
                         t.type === 'completed' ? '#15803d' : '#dc2626',
                  border: `1px solid ${t.type === 'running' ? 'rgba(251, 191, 36, 0.3)' : 
                                    t.type === 'completed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        )}
        {renderContent(textContent)}
      </>
    )
  }

  return (
    <div className="ai-advisor-root">
      {/* Section Title */}
      <div className="section-header fade-in ai-advisor-header">
        <div>
          <div className="section-eyebrow">Portfolio AI</div>
          <h1 className="section-title">持仓智研</h1>
        </div>
        <div className="ai-advisor-header-right">
          <button
            className="mobile-history-toggle"
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            {historyOpen ? <CloseOutlined /> : <MenuOutlined />}
            <span>历史</span>
          </button>
          <span className="chip ink">
            <span className="live-dot" />
            实时上下文
          </span>
          <span className="chip gold">
            <ThunderboltOutlined style={{ fontSize: 11 }} />
            DeepSeek
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="ai-advisor-body fade-in-1">
        {/* 左侧：历史 + 专业场景 */}
        <div className="ai-left-panel">
          <div className={`ai-history-panel ${historyOpen ? 'open' : ''}`}>
            <div className="panel-head" style={{ padding: '16px 18px' }}>
              <div className="panel-title" style={{ fontSize: 13 }}>
                <HistoryOutlined style={{ fontSize: 14 }} />
                历史对话
              </div>
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={createNewSession}
                style={{ color: 'var(--brand-600)', fontWeight: 600 }}
              >
                新建
              </Button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {sessions.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>暂无历史</span>}
                  style={{ marginTop: 40 }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sessions.map(s => {
                    const isActive = s.id === currentSessionId
                    return (
                      <div
                        key={s.id}
                        onClick={() => { setCurrentSessionId(s.id); setHistoryOpen(false) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '10px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isActive ? 'var(--ink-950)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--text-primary)',
                          border: isActive ? '1px solid var(--ink-950)' : '1px solid transparent',
                          transition: 'all 0.2s var(--ease-out)'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {s.title}
                          </div>
                          <div style={{
                            fontSize: 11, marginTop: 2,
                            color: isActive ? 'rgba(255,255,255,0.5)' : 'var(--text-tertiary)',
                            fontFamily: 'var(--font-mono)'
                          }}>
                            {new Date(s.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                            style={{
                              color: isActive ? 'rgba(255,255,255,0.5)' : 'var(--text-tertiary)',
                              flexShrink: 0
                            }}
                          />
                        </Tooltip>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧对话区 */}
        <div className="ai-chat-panel">
          {/* 消息列表 */}
          <div ref={scrollRef} className="ai-chat-messages">
            {currentSession?.messages.length === 0 && (
              <Empty description="开始对话吧" />
            )}
            {currentSession?.messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={idx}
                  className={`ai-message ${isUser ? 'user' : 'assistant'}`}
                >
                  {!isUser && (
                    <div className="ai-avatar assistant">
                      <RobotOutlined style={{ fontSize: 18 }} />
                    </div>
                  )}
                  <div className="ai-message-bubble">
                    {renderMessageContent(msg.content)}
                  </div>
                  {isUser && (
                    <div className="ai-avatar user">
                      U
                    </div>
                  )}
                </div>
              )
            })}
            {loading && (
              <div className="ai-message assistant">
                <div className="ai-avatar assistant">
                  <RobotOutlined style={{ fontSize: 18 }} />
                </div>
                <div className="ai-message-bubble loading">
                  <Spin size="small" />
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>AI 正在深度分析…</span>
                </div>
              </div>
            )}
          </div>

          {/* 场景选择区 */}
          <div className="ai-scenarios">
            <div className="ai-scenarios-group">
              <div className="ai-scenarios-label">
                <FundOutlined />
                专业分析
                <span className="ai-scenarios-hint-inline">
                  持仓智研基于你的实际持仓和资产数据生成建议 · 不构成投资建议
                </span>
              </div>
              <div className="ai-scenarios-scroll ai-scenarios-single-row">
                {PRO_SCENARIO_TEMPLATES.slice(0, 4).map(s => (
                  <div
                    key={s.key}
                    className={`ai-scenario-chip ${activeScenario?.key === s.key ? 'active' : ''}`}
                    onClick={() => handleProScenario(s)}
                  >
                    <span className="pro-scenario-chip-icon">{s.icon}</span>
                    <span>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 输入区 */}
          <div className="ai-input-area">
            <div className="ai-input-wrap">
              {activeScenario && (
                <div className="ai-skill-chip">
                  <span className="ai-skill-chip-icon">{activeScenario.icon}</span>
                  <span className="ai-skill-chip-text">{activeScenario.title}</span>
                  <span
                    className="ai-skill-chip-close"
                    onClick={() => setActiveScenario(null)}
                  >
                    ×
                  </span>
                </div>
              )}
              <div className="ai-input-row">
                <TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      sendMessage(input, activeScenario || undefined)
                    }
                  }}
                  placeholder={activeScenario ? '补充你的问题或直接发送...（Enter 发送 · Shift+Enter 换行）' : '向持仓智研提问（Enter 发送 · Shift+Enter 换行）'}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={loading}
                  variant="borderless"
                  style={{ resize: 'none' }}
                />
                <Button
                  type="primary"
                  icon={loading ? <StopOutlined /> : <SendOutlined />}
                  onClick={() => sendMessage(input, activeScenario || undefined)}
                  disabled={(!input.trim() && !activeScenario) || loading}
                  className="ai-send-btn"
                >
                  {loading ? '思考' : '发送'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
