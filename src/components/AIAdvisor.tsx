// AI 投顾页
// 设计风格：Modern Wealth Terminal
// 特点：双栏对话（历史 + 当前会话）、快捷场景、智能体上下文

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Input, Button, Empty, Spin, message, Tooltip, message as antdMessage
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

const { TextArea } = Input

export default function AIAdvisor() {
  const { assets, loadAssets } = useAssetStore()
  const { holdings, loadHoldings } = useHoldingStore()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  async function sendMessage(text: string, isProScenario: boolean = false) {
    if (!text.trim() || loading || !currentSession) return

    const userMsg: ChatMessage = { role: 'user', content: text, ts: Date.now() }
    const session = { ...currentSession, messages: [...currentSession.messages, userMsg] }
    if (session.title === '新对话' && currentSession.messages.length <= 1) {
      session.title = text.slice(0, 20) + (text.length > 20 ? '...' : '')
    }
    session.updatedAt = new Date().toISOString()

    const updatedSessions = sessions.map(s => s.id === session.id ? session : s)
    setSessions(updatedSessions)
    setInput('')
    setLoading(true)

    try {
      const ctx = isProScenario ? buildFinancialContext() : undefined
      const { reply } = await chat(
        session.messages.map(m => ({ role: m.role, content: m.content })),
        { context: ctx }
      )
      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, ts: Date.now() }
      const finalSession = { ...session, messages: [...session.messages, assistantMsg], updatedAt: new Date().toISOString() }
      const finalSessions = updatedSessions.map(s => s.id === finalSession.id ? finalSession : s)
      setSessions(finalSessions)
      saveLocalHistory(finalSessions)
      saveHistoryToApi(finalSessions)
    } catch (e: any) {
      antdMessage.error('调用失败：' + (e.message || e))
    } finally {
      setLoading(false)
      setActiveScenario(null)
    }
  }

  function handleProScenario(scenario: ProScenarioTemplate) {
    setActiveScenario(scenario.key)
    const fullPrompt = `【${scenario.title}】\n\n${scenario.prompt}\n\n请严格按照上述结构输出，使用 Markdown 格式，确保每个章节都有数据支撑。`
    sendMessage(fullPrompt, true)
  }

  // 解析结构化内容（标题 + 要点 + 数据引用）
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

      // 二级标题
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

      // 列表项
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        listItems.push(trimmed.replace(/^[-•]\s+/, ''))
        return
      }

      // 空行
      if (trimmed === '') {
        flushList()
        return
      }

      // 普通段落
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

  // 简单的 markdown 渲染（粗体）
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

  // 只保留4个核心专业场景
  const filteredProScenarios = useMemo(() => {
    const keepKeys = ['stock_deep_analysis', 'sector_stock_pick', 'risk_assessment', 'portfolio_optimization']
    return PRO_SCENARIO_TEMPLATES.filter(s => keepKeys.includes(s.key))
  }, [])

  // 按类别分组专业场景
  const proScenariosByCategory = useMemo(() => {
    const groups: Record<string, ProScenarioTemplate[]> = {}
    PRO_SCENARIO_TEMPLATES.forEach(s => {
      if (!groups[s.category]) groups[s.category] = []
      groups[s.category].push(s)
    })
    return groups
  }, [])

  return (
    <div className="ai-advisor-root">
      {/* ============ Section Title ============ */}
      <div className="section-header fade-in ai-advisor-header">
        <div>
          <div className="section-eyebrow">AI Advisor</div>
          <h1 className="section-title">AI 投顾</h1>
        </div>
        <div className="ai-advisor-header-right">
          {/* Mobile history toggle */}
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

      {/* ============ Body ============ */}
      <div className="ai-advisor-body fade-in-1">
        {/* ===== 左侧：历史 + 专业场景 ===== */}
        <div className="ai-left-panel">
          {/* 历史对话 */}
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

        {/* ===== 右侧对话区 ===== */}
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
                    {renderContent(msg.content)}
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

          {/* 场景选择区（专业分析） */}
          <div className="ai-scenarios">
            <div className="ai-scenarios-group">
              <div className="ai-scenarios-label">
                <FundOutlined />
                专业分析
                <span className="ai-scenarios-hint-inline">
                  AI 投顾基于你的实际持仓和资产数据生成建议 · 不构成投资建议
                </span>
              </div>
              <div className="ai-scenarios-scroll ai-scenarios-single-row">
                {filteredProScenarios.map(s => (
                  <div
                    key={s.key}
                    className={`ai-scenario-chip ${activeScenario === s.key ? 'active' : ''}`}
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
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                placeholder="向 AI 投顾提问（Enter 发送 · Shift+Enter 换行）"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={loading}
                variant="borderless"
                style={{ resize: 'none' }}
              />
              <Button
                type="primary"
                icon={loading ? <StopOutlined /> : <SendOutlined />}
                onClick={() => sendMessage(input)}
                disabled={!input.trim() && !loading}
                className="ai-send-btn"
              >
                {loading ? '思考' : '发送'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
