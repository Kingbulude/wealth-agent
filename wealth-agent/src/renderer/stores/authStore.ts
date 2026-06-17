import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthState } from '../types/user'
import { generateToken, hashPassword, verifyPassword } from '../utils/auth'

const STORAGE_KEY = 'wealth_agent_users'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      register: async (email: string, password: string) => {
        const users = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        
        if (users.find((u: User) => u.email === email)) {
          return false
        }

        const newUser: User = {
          id: crypto.randomUUID(),
          email,
          passwordHash: await hashPassword(password),
          createdAt: new Date().toISOString()
        }

        users.push(newUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users))

        const token = generateToken()
        set({
          user: newUser,
          token,
          isAuthenticated: true
        })

        return true
      },

      login: async (email: string, password: string) => {
        const users = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        const user = users.find((u: User) => u.email === email)

        if (!user) {
          return false
        }

        const isValid = await verifyPassword(password, user.passwordHash)
        if (!isValid) {
          return false
        }

        const token = generateToken()
        set({
          user,
          token,
          isAuthenticated: true
        })

        return true
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false
        })
      },

      checkAuth: () => {
        const state = get()
        if (!state.token) {
          set({ isAuthenticated: false, user: null })
        }
      }
    }),
    {
      name: 'wealth-agent-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)