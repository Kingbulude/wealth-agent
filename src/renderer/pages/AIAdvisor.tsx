import { useState, useEffect, useRef } from 'react'
import {
  Card, Input, Button, Space, Tag, Empty, Spin, message, List, Avatar, Typography, Tooltip
} from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, PlusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { chat, ChatMessage, ChatSession, SCENARIO_TEMPLATES, loadHistoryFromApi, saveHistoryToApi, getLocalHistory, saveLocalHistory } from '../services/aiService'

const { TextArea } = Input
const { Text, Paragraph } = Typography

const STORAGE_KEY = 'wealth_agent_ai_current_session'

export default function AIAdvisor() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 加载历史
  useEffect(() => {
    (async () => {
      const apiSessions = await loadHistoryFromApi()
      const list = apiSessions || getLocalHistory()
      setSessions(list)
      if (list.length > 0) {
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
  }, [currentSessionId, sessions])

  const currentSession = sessions.find(s => s.id === currentSessionId)

  function createNewSession() {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: '新对话',
      messages: [
        {
          role: 'assistant',
          content: '👋 你好！我是你的 AI 财富顾问。\n\n我可以基于你的**实际持仓和资产**给出专业建议。\n\n试试下方的快捷场景，或直接提问：',
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
    // 自动用首条用户消息做标题
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
      message.error('调用失败：' + (e.message || e))
    } finally {
      setLoading(false)
    }
  }

  function handleScenario(prompt: string) {
    sendMessage(prompt)
  }

  return (
    <div style={{ padding: 24, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <RobotOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Typography.Title level={3} style={{ margin: 0 }}>AI 投顾</Typography.Title>
          <Tag color="cyan">基于你的真实账户数据</Tag>
        </Space>
        <Space>
          <Button icon={<PlusOutlined />} onClick={createNewSession}>新对话</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* 左侧历史侧栏 */}
        <Card style={{ width: 240, flexShrink: 0 }} bodyStyle={{ padding: 12, height: '100%', overflow: 'auto' }}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>历史对话</Typography.Text>
          {sessions.length === 0 ? (
            <Empty description="暂无历史" imageStyle={{ height: 60 }} />
          ) : (
            <List
              dataSource={sessions}
              renderItem={(s) => (
                <List.Item
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: s.id === currentSessionId ? '#e6f7ff' : 'transparent',
                    borderRadius: 6,
                    marginBottom: 4
                  }}
                  onClick={() => setCurrentSessionId(s.id)}
                  actions={[
                    <Tooltip key="del" title="删除">
                      <Button
                        type="text" size="small" icon={<DeleteOutlined />}
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                      />
                    </Tooltip>
                  ]}
                >
                  <Typography.Text ellipsis style={{ width: 160 }}>{s.title}</Typography.Text>
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* 右侧对话区 */}
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }} bodyStyle={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 消息列表 */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {currentSession?.messages.length === 0 && (
              <Empty description="开始对话吧" />
            )}
            {currentSession?.messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 16
                }}
              >
                {msg.role === 'assistant' && (
                  <Avatar icon={<RobotOutlined />} style={{ background: '#1890ff', marginRight: 8, flexShrink: 0 }} />
                )}
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: msg.role === 'user' ? '#1890ff' : '#f5f5f5',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: 14,
                    lineHeight: 1.6
                  }}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <Avatar icon={<UserOutlined />} style={{ background: '#52c41a', marginLeft: 8, flexShrink: 0 }} />
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 40 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ marginLeft: 8 }}>AI 正在思考...</Text>
              </div>
            )}
          </div>

          {/* 快捷场景 */}
          <div style={{ padding: '8px 24px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Space size={[8, 8]} wrap>
              <Text type="secondary" style={{ fontSize: 12 }}>💡 快捷场景：</Text>
              {SCENARIO_TEMPLATES.map(s => (
                <Tag
                  key={s.key}
                  icon={<ThunderboltOutlined />}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleScenario(s.prompt)}
                >
                  {s.title}
                </Tag>
              ))}
            </Space>
          </div>

          {/* 输入区 */}
          <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                placeholder="向 AI 投顾提问（Enter 发送，Shift+Enter 换行）"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={loading}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={loading}
                onClick={() => sendMessage(input)}
                style={{ height: 'auto' }}
              >
                发送
              </Button>
            </Space.Compact>
          </div>
        </Card>
      </div>
    </div>
  )
}
