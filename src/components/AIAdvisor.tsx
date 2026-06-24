// AI 投顾页
// 设计风格：Modern Wealth Terminal
// 特点：双栏对话（历史 + 当前会话）、快捷场景、智能体上下文

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Input, Button, Empty, Spin, message, Tooltip, message as antdMessage
} from 'antd'
import {
  SendOutlined, RobotOutlined, UserOutlined, PlusOutlined,
  DeleteOutlined, ThunderboltOutlined, BulbOutlined,
  StopOutlined, HistoryOutlined
} from '@ant-design/icons'
import { chat, ChatMessage, ChatSession, SCENARIO_TEMPLATES, loadHistoryFromApi, saveHistoryToApi, getLocalHistory, saveLocalHistory } from '../services/aiService'
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

试试下方的快捷场景，或直接提问：`,
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

  async function sendMessage(text: string) {
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
      const { reply } = await chat(session.messages.map(m => ({ role: m.role, content: m.content })))
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
    }
  }

  function handleScenario(prompt: string) {
    sendMessage(prompt)
  }

  // 简单的 markdown 渲染（粗体）
  function renderContent(content: string) {
    const parts = content.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      height: 'calc(100vh - 200px)',
      minHeight: 600
    }}>
      {/* ============ Section Title ============ */}
      <div className="section-header fade-in">
        <div>
          <div className="section-eyebrow">AI Advisor</div>
          <h1 className="section-title">AI 投顾</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }} className="fade-in-1">
        {/* ===== 左侧历史侧栏 ===== */}
        <div className="panel" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
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
                      onClick={() => setCurrentSessionId(s.id)}
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

        {/* ===== 右侧对话区 ===== */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* 消息列表 */}
          <div ref={scrollRef} style={{
            flex: 1, overflowY: 'auto',
            padding: '32px 36px',
            background: 'linear-gradient(180deg, #fafbfd 0%, #ffffff 100%)'
          }}>
            {currentSession?.messages.length === 0 && (
              <Empty description="开始对话吧" />
            )}
            {currentSession?.messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    marginBottom: 20,
                    animation: 'fadeUp 0.4s var(--ease-out) both'
                  }}
                >
                  {!isUser && (
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'linear-gradient(135deg, #0a0e1a 0%, #161b2e 100%)',
                      color: 'var(--brand-400)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginRight: 12, flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(10, 14, 26, 0.18)'
                    }}>
                      <RobotOutlined style={{ fontSize: 18 }} />
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: '72%',
                      padding: '14px 18px',
                      borderRadius: 14,
                      background: isUser
                        ? 'linear-gradient(135deg, #0a0e1a 0%, #1e2438 100%)'
                        : '#fff',
                      color: isUser ? '#fff' : 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 14,
                      lineHeight: 1.7,
                      boxShadow: isUser
                        ? '0 4px 12px rgba(10, 14, 26, 0.18)'
                        : '0 1px 3px rgba(15, 20, 36, 0.05)',
                      border: isUser ? 'none' : '1px solid var(--card-border)'
                    }}
                  >
                    {renderContent(msg.content)}
                  </div>
                  {isUser && (
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'linear-gradient(135deg, var(--brand-500), var(--brand-600))',
                      color: '#0a0e1a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginLeft: 12, flexShrink: 0,
                      fontWeight: 700, fontSize: 14
                    }}>
                      U
                    </div>
                  )}
                </div>
              )
            })}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 48 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #0a0e1a 0%, #161b2e 100%)',
                  color: 'var(--brand-400)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 12
                }}>
                  <RobotOutlined style={{ fontSize: 18 }} />
                </div>
                <div style={{
                  padding: '14px 18px',
                  background: '#fff',
                  border: '1px solid var(--card-border)',
                  borderRadius: 14,
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <Spin size="small" />
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>AI 正在思考…</span>
                </div>
              </div>
            )}
          </div>

          {/* 快捷场景 */}
          <div style={{
            padding: '14px 28px',
            borderTop: '1px solid var(--card-border)',
            background: 'var(--app-bg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                letterSpacing: '0.16em', textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
                <BulbOutlined />
                QUICK SCENARIOS
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SCENARIO_TEMPLATES.map(s => (
                <div
                  key={s.key}
                  onClick={() => handleScenario(s.prompt)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px',
                    background: '#fff',
                    border: '1px solid var(--card-border)',
                    borderRadius: 999,
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s var(--ease-out)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--brand-500)'
                    e.currentTarget.style.color = 'var(--brand-600)'
                    e.currentTarget.style.background = 'rgba(201, 167, 106, 0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--card-border)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.background = '#fff'
                  }}
                >
                  <ThunderboltOutlined style={{ fontSize: 11, color: 'var(--brand-500)' }} />
                  {s.title}
                </div>
              ))}
            </div>
          </div>

          {/* 输入区 */}
          <div style={{ padding: '18px 28px 22px', background: '#fff' }}>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: 'var(--app-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 14,
              padding: '8px 8px 8px 16px',
              transition: 'all 0.2s var(--ease-out)'
            }}>
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
                style={{
                  height: 38, minWidth: 80,
                  background: 'var(--ink-950)',
                  borderColor: 'var(--ink-950)',
                  fontWeight: 600
                }}
              >
                {loading ? '思考' : '发送'}
              </Button>
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)',
              marginTop: 8, textAlign: 'center'
            }}>
              AI 投顾基于你的实际持仓和资产数据生成建议 · 不构成投资建议
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
