import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthState } from '../types/user'

// 本地用户数据库（兼容旧数据）
const USERS_KEY = 'wealth_agent_users'
const AUTH_KEY = 'wealth-agent-auth'

function getLocalUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLocalUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function hashPassword(password: string): string {
  const salt = password.slice(0, 3) + password.slice(-3)
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash + char + salt.charCodeAt(i % salt.length)) | 0
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + salt
}

function generateToken(): string {
  return 'tk_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// 检测是否在 Cloudflare Pages 生产环境（有 /api 代理）
const HAS_API_PROXY = typeof window !== 'undefined' && /pages\.dev$/.test(window.location.hostname)

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      register: async (email: string, password: string) => {
        // 1) 生产环境：调用后端 API
        if (HAS_API_PROXY) {
          try {
            const resp = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            })
            const json = await resp.json()
            if (json.ok) {
              set({
                user: { id: json.data.id, email: json.data.email, createdAt: json.data.createdAt },
                token: json.data.token,
                isAuthenticated: true
              })
              return true
            }
            return false
          } catch (e) {
            console.warn('API 注册失败，降级到本地:', e)
          }
        }

        // 2) 降级：本地注册（兼容旧模式 + 本地开发）
        const users = getLocalUsers()
        if (users.find((u: User) => u.email === email)) {
          return false
        }
        const newUser: User = {
          id: crypto.randomUUID(),
          email,
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString()
        }
        users.push(newUser)
        saveLocalUsers(users)
        const token = generateToken()
        set({
          user: { id: newUser.id, email: newUser.email, createdAt: newUser.createdAt },
          token,
          isAuthenticated: true
        })
        return true
      },

      login: async (email: string, password: string) => {
        // 1) 生产环境：调用后端 API
        if (HAS_API_PROXY) {
          try {
            const resp = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            })
            const json = await resp.json()
            if (json.ok) {
              set({
                user: { id: json.data.id, email: json.data.email, createdAt: json.data.createdAt },
                token: json.data.token,
                isAuthenticated: true
              })
              return true
            }
            return false
          } catch (e) {
            console.warn('API 登录失败，降级到本地:', e)
          }
        }

        // 2) 降级：本地登录
        const users = getLocalUsers()
        const user = users.find((u: User) => u.email === email)
        if (!user) return false
        if (user.passwordHash !== hashPassword(password)) return false

        const token = generateToken()
        set({
          user: { id: user.id, email: user.email, createdAt: user.createdAt },
          token,
          isAuthenticated: true
        })
        return true
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },

      checkAuth: () => {
        const state = get()
        if (!state.token) {
          set({ isAuthenticated: false, user: null })
        }
      }
    }),
    {
      name: AUTH_KEY,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
