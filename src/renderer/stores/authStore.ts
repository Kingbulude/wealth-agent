import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthState } from '../types/user'
import { getApiUrl } from '../../utils/apiUrl'

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

function isLikelyPages(): boolean {
  if (typeof window === 'undefined') return false
  // Capacitor 原生 App：WebView 的 hostname 是 localhost，必须走云端 API
  if (typeof (window as any).Capacitor !== 'undefined') return true
  const host = window.location.hostname
  if (/pages\.dev$/.test(host)) return true
  if (host === 'localhost' || host === '127.0.0.1') return false
  if (/^localhost:\d+/.test(window.location.host)) return false
  if (typeof (window as any).electronAPI !== 'undefined') return true
  return true
}

let apiAvailableCache: boolean | null = null
let apiAvailableCacheTime: number = 0
const API_CACHE_TTL = 60_000 // 60秒后允许重试

async function checkApiAvailable(): Promise<boolean> {
  // 缓存有效期内直接返回
  if (apiAvailableCache !== null && Date.now() - apiAvailableCacheTime < API_CACHE_TTL) {
    return apiAvailableCache
  }
  if (!isLikelyPages()) {
    apiAvailableCache = false
    apiAvailableCacheTime = Date.now()
    return false
  }
  try {
    const resp = await fetch(getApiUrl('/health'), { method: 'GET' })
    const json = await resp.json()
    apiAvailableCache = json.ok === true && json.data?.db === 'connected'
    apiAvailableCacheTime = Date.now()
    return apiAvailableCache
  } catch {
    apiAvailableCache = false
    apiAvailableCacheTime = Date.now()
    return false
  }
}

async function ensureDatabaseInitialized(): Promise<boolean> {
  if (!await checkApiAvailable()) return false
  try {
    const resp = await fetch(getApiUrl('/init'), { method: 'POST' })
    const json = await resp.json()
    return json.ok === true
  } catch {
    return false
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isNewUser: false,

      register: async (email: string, password: string) => {
        // 确保数据库已初始化
        await ensureDatabaseInitialized()

        if (await checkApiAvailable()) {
          try {
            const resp = await fetch(getApiUrl('/auth/register'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            })
            const json = await resp.json()
            if (json.ok) {
              set({
                user: { id: json.data.id, email: json.data.email, createdAt: json.data.createdAt },
                token: json.data.token,
                isAuthenticated: true,
                isNewUser: true
              })
              return true
            }
            return false
          } catch (e) {
            console.warn('API 注册失败，降级到本地:', e)
          }
        }

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
          isAuthenticated: true,
          isNewUser: true
        })
        return true
      },

      login: async (email: string, password: string) => {
        // 确保数据库已初始化
        await ensureDatabaseInitialized()

        if (await checkApiAvailable()) {
          try {
            const resp = await fetch(getApiUrl('/auth/login'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            })
            const json = await resp.json()
            if (json.ok) {
              set({
                user: { id: json.data.id, email: json.data.email, createdAt: json.data.createdAt },
                token: json.data.token,
                isAuthenticated: true,
                isNewUser: false
              })
              return true
            }
            return false
          } catch (e) {
            console.warn('API 登录失败，降级到本地:', e)
          }
        }

        const users = getLocalUsers()
        const user = users.find((u: User) => u.email === email)
        if (!user) return false
        if (user.passwordHash !== hashPassword(password)) return false

        const token = generateToken()
        set({
          user: { id: user.id, email: user.email, createdAt: user.createdAt },
          token,
          isAuthenticated: true,
          isNewUser: false
        })
        return true
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, isNewUser: false })
      },

      checkAuth: () => {
        const state = get()
        if (!state.token) {
          set({ isAuthenticated: false, user: null, isNewUser: false })
        }
      },

      clearNewUserFlag: () => {
        set({ isNewUser: false })
      }
    }),
    {
      name: AUTH_KEY,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isNewUser: state.isNewUser
      })
    }
  )
)
