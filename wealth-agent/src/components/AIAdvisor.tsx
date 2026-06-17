import { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Space, Spin, Empty } from 'antd'
import { SendOutlined, RobotOutlined, ClearOutlined } from '@ant-design/icons'
import ChatMessage from './ChatMessage'
import { useAIStore } from '../stores/aiStore'
import { sendMessageToAI } from '../services/aiService'
import { message as antMessage } from 'antd'

const { TextArea } = Input

export default function AIAdvisor() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { messages, addMessage, clearMessages } = useAIStore()
  
  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)
    
    // 添加用户消息
    addMessage('user', userMessage)
    
    try {
      // 调用AI服务
      const response = await sendMessageToAI(userMessage)
      
      // 添加AI回复
      addMessage('assistant', response)
    } catch (error) {
      antMessage.error('AI回复失败，请重试')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  
  const handleClear = () => {
    clearMessages()
    antMessage.success('对话已清空')
  }
  
  return (
    <Card
      title={
        <Space>
          <RobotOutlined style={{ color: '#1890ff' }} />
          <span>AI财富顾问</span>
        </Space>
      }
      extra={
        <Button 
          icon={<ClearOutlined />} 
          size="small"
          onClick={handleClear}
        >
          清空
        </Button>
      }
      style={{ height: '100%' }}
      bodyStyle={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: 'calc(100% - 57px)',
        padding: 0
      }}
    >
      {/* 消息列表 */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: 16,
        backgroundColor: '#fafafa'
      }}>
        {messages.length === 0 ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                还没有开始对话，试试问我：
                <br />
                "我的投资风险如何？"、"如何优化资产配置？"
              </span>
            }
          />
        ) : (
          messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Spin tip="AI思考中..." />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* 输入框 */}
      <div style={{ 
        padding: 16, 
        borderTop: '1px solid #f0f0f0',
        backgroundColor: 'white'
      }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的问题，按Enter发送..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={isLoading}
          />
          <Button 
            type="primary" 
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={isLoading}
            disabled={!input.trim()}
          >
            发送
          </Button>
        </Space.Compact>
        <div style={{ 
          marginTop: 8, 
          fontSize: 12, 
          color: '#999',
          textAlign: 'center'
        }}>
          AI建议仅供参考，不构成投资建议
        </div>
      </div>
    </Card>
  )
}