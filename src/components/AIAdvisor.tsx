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
import { STRATEGIES, type StrategyConfig } from '../config/strategies'
import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { useAuthStore } from '../renderer/stores/authStore'
import { getApiUrl } from '../utils/apiUrl'

const { TextArea } = Input

// 思考步骤类型
interface ThinkingStep {
  id: string
  label: string
  status: 'running' | 'completed' | 'error'
  time: number
}

// 更新占位消息内容（纯文本，不含工具调用）
function updatePlaceholderMessage(
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
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
  const [activeStrategy, setActiveStrategy] = useState<StrategyConfig | null>(null)
  const [strategyPanelOpen, setStrategyPanelOpen] = useState(false)
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([])
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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
  async function sendMessage(text: string, skill?: ProScenarioTemplate, strategy?: StrategyConfig) {
    const hasContent = text.trim() || skill || strategy
    if (!hasContent || loading || !currentSession) return

    let finalContent = text
    let isProScenario = false

    if (skill) {
      isProScenario = true
      const userQuery = text.trim() ? `\n\n用户问题：${text.trim()}` : '\n\n请基于我的实际持仓和资产数据进行分析。'
      finalContent = `【${skill.title}】\n\n${skill.prompt}${userQuery}`
    }

    // 如果选择了策略，在消息中标注
    if (strategy && !skill) {
      finalContent = finalContent || `请使用【${strategy.displayName}】策略进行分析。`
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

    // 重置思考步骤
    setThinkingSteps([])
    setThinkingExpanded(false)

    // 添加空的消息占位
    const placeholderMsg: ChatMessage = { role: 'assistant', content: '', ts: Date.now() }
    const sessionWithPlaceholder = {
      ...session,
      messages: [...session.messages, placeholderMsg]
    }
    const updatedSessionsWithPlaceholder = updatedSessions.map(s => s.id === session.id ? sessionWithPlaceholder : s)
    setSessions(updatedSessionsWithPlaceholder)

    try {
      // 所有对话都注入持仓上下文（精简版），确保AI能基于真实数据分析
      const ctx = buildFinancialContext()
      const query = encodeURIComponent(finalContent)
      const contextParam = ctx ? `&context=${encodeURIComponent(ctx)}` : ''

      const token = useAuthStore.getState().token
      const strategyParam = activeStrategy ? `&strategy=${encodeURIComponent(activeStrategy.name)}` : ''
      const response = await fetch(getApiUrl(`/ai/stock-analysis-stream?query=${query}${contextParam}${strategyParam}`), {
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

              if (currentEvent === 'tool_start') {
                const stepId = data.tool || `step-${Date.now()}`
                setThinkingSteps(prev => [...prev, {
                  id: stepId,
                  label: data.label || data.tool || '执行中...',
                  status: 'running',
                  time: Date.now()
                }])
                currentEvent = ''
                continue
              }

              if (currentEvent === 'tool_end') {
                const stepId = data.tool || ''
                setThinkingSteps(prev => prev.map(s =>
                  s.id === stepId ? { ...s, status: data.status === 'completed' ? 'completed' : 'error' } : s
                ))
                currentEvent = ''
                continue
              }

              if (currentEvent === 'token' || (data.content !== undefined && currentEvent !== 'done')) {
                const tokenContent = data.content || ''
                assistantContent += tokenContent
                updatePlaceholderMessage(setSessions, session.id, placeholderMsg.ts || Date.now(), assistantContent)
                currentEvent = ''
                continue
              }

              if (currentEvent === 'done' || data.reply !== undefined) {
                const finalReply = data.reply || ''
                if (finalReply && assistantContent.length < 20) {
                  assistantContent = finalReply
                }
                updatePlaceholderMessage(setSessions, session.id, placeholderMsg.ts || Date.now(), assistantContent)
                setThinkingSteps([])
                currentEvent = ''
              }

              if (currentEvent === 'error' || data.message) {
                const errMsg = data.message || '分析出错'
                assistantContent = `❌ ${errMsg}`
                updatePlaceholderMessage(setSessions, session.id, placeholderMsg.ts || Date.now(), assistantContent)
                setThinkingSteps([])
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
        const ctx = buildFinancialContext()
        const { reply } = await chat(
          session.messages.map(m => ({ role: m.role, content: m.content })),
          { context: ctx, strategy: activeStrategy || undefined }
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
      setThinkingSteps([])
    }
  }

  function handleProScenario(scenario: ProScenarioTemplate) {
    setActiveScenario(scenario)
    setActiveStrategy(null)
  }

  function handleStrategySelect(strategy: StrategyConfig) {
    setActiveStrategy(strategy)
    setActiveScenario(null)
    setStrategyPanelOpen(false)
  }

  function clearStrategy() {
    setActiveStrategy(null)
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
                <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* 思考过程折叠面板 */}
                  {thinkingSteps.length > 0 && (
                    <div className="ai-thinking-panel">
                      <div
                        className="ai-thinking-header"
                        onClick={() => setThinkingExpanded(!thinkingExpanded)}
                      >
                        <Spin size="small" />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          深度分析中… ({thinkingSteps.filter(s => s.status === 'completed').length}/{thinkingSteps.length})
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                          {thinkingExpanded ? '收起' : '展开'}
                        </span>
                      </div>
                      {thinkingExpanded && (
                        <div className="ai-thinking-steps">
                          {thinkingSteps.map((step, i) => (
                            <div key={i} className={`ai-thinking-step ${step.status}`}>
                              <span style={{ fontSize: 12, marginRight: 4 }}>
                                {step.status === 'running' ? '⏳' : step.status === 'completed' ? '✅' : '⚠️'}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{step.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* 消息气泡 */}
                  <div className="ai-message-bubble loading">
                    <Spin size="small" />
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>AI 正在深度分析…</span>
                  </div>
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
            {/* 策略选择 */}
            <div className="ai-scenarios-group" style={{ marginTop: 8 }}>
              <div className="ai-scenarios-label">
                <ThunderboltOutlined style={{ fontSize: 12 }} />
                分析策略
                <span className="ai-scenarios-hint-inline">
                  选择策略框架，AI 将按策略规则分析
                </span>
              </div>
              <div className="ai-scenarios-scroll ai-scenarios-single-row">
                {STRATEGIES.map(s => (
                  <div
                    key={s.name}
                    className={`ai-scenario-chip strategy-chip ${activeStrategy?.name === s.name ? 'active' : ''}`}
                    onClick={() => handleStrategySelect(s)}
                    title={s.description}
                  >
                    <span>{s.displayName}</span>
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
              {activeStrategy && (
                <div className="ai-skill-chip strategy">
                  <span className="ai-skill-chip-icon">⚡</span>
                  <span className="ai-skill-chip-text">{activeStrategy.displayName}</span>
                  <span
                    className="ai-skill-chip-close"
                    onClick={clearStrategy}
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
                      sendMessage(input, activeScenario || undefined, activeStrategy || undefined)
                    }
                  }}
                  placeholder={activeScenario ? '补充你的问题或直接发送...（Enter 发送 · Shift+Enter 换行）' : activeStrategy ? `使用【${activeStrategy.displayName}】策略分析...` : '向持仓智研提问（Enter 发送 · Shift+Enter 换行）'}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={loading}
                  variant="borderless"
                  style={{ resize: 'none' }}
                />
                <Button
                  type="primary"
                  icon={loading ? <StopOutlined /> : <SendOutlined />}
                  onClick={() => sendMessage(input, activeScenario || undefined, activeStrategy || undefined)}
                  disabled={(!input.trim() && !activeScenario && !activeStrategy) || loading}
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
