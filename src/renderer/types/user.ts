export interface User {
  id: string
  email: string
  passwordHash?: string
  createdAt: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isNewUser: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => void
  clearNewUserFlag: () => void
}