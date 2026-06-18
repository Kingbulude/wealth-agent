import { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Space, Spin, Empty, Tag } from 'antd'
import { SendOutlined, RobotOutlined, ClearOutlined, LineChartOutlined, RiseOutlined, AlertOutlined, WalletOutlined } from '@ant-design/icons'
import ChatMessage from './ChatMessage'
import { useAIStore } from '../stores/aiStore'
import { sendMessageToAI } from '../services/aiService'
import { useHoldingStore } from '../stores/holdingStore'
import { message as antMessage } from 'antd'

const { TextArea } = Input

const quickQuestions = [
  { icon: LineChartOutlined, text: '分析我的持仓', color: 'blue' },
  { icon: RiseOutlined, text: '评估投资收益', color: 'green' },
  { icon: AlertOutlined, text: '评估风险等级', color: 'orange' },
  { icon: WalletOutlined, text: '优化资产配置', color: 'purple' }
]

export default function AIAdvisor() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { messages, addMessage, clearMessages } = useAIStore()
  const { holdings, getTotalValue, getTotalProfit } = useHoldingStore()
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)
    
    addMessage('user', userMessage)
    
    try {
      const response = await sendMessageToAI(userMessage)
      addMessage('assistant', response)
    } catch (error) {
      antMessage.error('AI回复失败，请重试')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleQuickQuestion = async (question: string) => {
    if (isLoading) return
    
    setInput(question)
    setIsLoading(true)
    addMessage('user', question)
    
    try {
      const response = await sendMessageToAI(question)
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
      {/* 快捷提问栏 */}
      <div style={{ 
        padding: 12, 
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: 'white'
      }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>快捷提问：</div>
        <Space wrap>
          {quickQuestions.map((item, index) => (
            <Tag
              key={index}
              icon={<item.icon />}
              color={item.color}
              style={{ cursor: 'pointer', padding: '4px 12px' }}
              onClick={() => handleQuickQuestion(item.text)}
            >
              {item.text}
            </Tag>
          ))}
        </Space>
      </div>
      
      {/* 持仓摘要提示 */}
      {holdings.length > 0 && (
        <div style={{ 
          padding: 8, 
          backgroundColor: '#e6f7ff',
          borderBottom: '1px solid #91d5ff'
        }}>
          <div style={{ fontSize: 12, color: '#1890ff' }}>
            📈 当前持仓：{holdings.length}个标的，总市值 ¥{getTotalValue().toLocaleString()}，
            盈亏 {getTotalProfit() >= 0 ? '+' : ''}¥{getTotalProfit().toLocaleString()}
          </div>
        </div>
      )}
      
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