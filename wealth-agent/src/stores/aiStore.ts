import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface AIState {
  messages: Message[]
  isLoading: boolean
  addMessage: (role: 'user' | 'assistant', content: string) => void
  setLoading: (loading: boolean) => void
  clearMessages: () => void
}

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  isLoading: false,
  
  addMessage: (role, content) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date().toISOString()
    }
    set({ messages: [...get().messages, newMessage] })
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  clearMessages: () => set({ messages: [] })
}))