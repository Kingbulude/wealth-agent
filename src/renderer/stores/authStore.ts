import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthState } from '../types/user'
import { getApiUrl } from '../../utils/apiUrl'

const AUTH_KEY = 'wealth-agent-auth'

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
        await ensureDatabaseInitialized()

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
          console.warn('API 注册失败:', e)
          return false
        }
      },

      login: async (email: string, password: string) => {
        await ensureDatabaseInitialized()

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
          console.warn('API 登录失败:', e)
          return false
        }
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
