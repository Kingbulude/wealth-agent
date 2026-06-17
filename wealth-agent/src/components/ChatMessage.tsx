import { Avatar, Typography } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import { Message } from '../stores/aiStore'

const { Text } = Typography

interface ChatMessageProps {
  message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16 
    }}>
      {!isUser && (
        <Avatar 
          icon={<RobotOutlined />} 
          style={{ marginRight: 8, backgroundColor: '#1890ff' }} 
        />
      )}
      
      <div style={{ 
        maxWidth: '70%',
        backgroundColor: isUser ? '#1890ff' : '#f5f5f5',
        color: isUser ? 'white' : '#333',
        borderRadius: 12,
        padding: '12px 16px'
      }}>
        {isUser ? (
          <Text style={{ color: 'white' }}>{message.content}</Text>
        ) : (
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      
      {isUser && (
        <Avatar 
          icon={<UserOutlined />} 
          style={{ marginLeft: 8, backgroundColor: '#52c41a' }} 
        />
      )}
    </div>
  )
}