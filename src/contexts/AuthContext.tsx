import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// ============ 类型定义 ============
export interface AuthUser {
  id: string
  username: string
  email: string
  phone?: string
  phoneVerified?: boolean
  avatar?: string
  bio?: string
  createdAt: string
  updatedAt: string
  wechatOpenId?: string
  wechatNickname?: string
  qqOpenId?: string
  qqNickname?: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  loading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string, phone?: string) => Promise<void>
  phoneLogin: (phone: string, code: string, username?: string) => Promise<void>
  sendSMSCode: (phone: string) => Promise<{ success: boolean; waitSeconds?: number }>
  wechatLogin: () => Promise<void>
  qqLogin: () => Promise<void>
  handleOAuthCallback: (code: string, provider: 'wechat' | 'qq') => Promise<void>
  logout: () => void
  clearError: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// ============ 存储 key ============
const TOKEN_KEY = 'memoir_auth_token'
const USER_KEY = 'memoir_auth_user'

// ============ API 基础 URL ============
function getApiUrl(): string {
  return (window as any)._memoirBackendUrl || ''
}

function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const apiUrl = getApiUrl()
  const url = `${apiUrl.replace(/\/$/, '')}${path}`
  return fetch(url, options)
}

// ============ Provider ============
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
    error: null,
  })

  // 初始化：从 localStorage 恢复
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthUser
        setState({ user, token, loading: false, error: null })
        verifyAndRefresh(token)
      } catch {
        setState({ user: null, token: null, loading: false, error: null })
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    } else {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [])

  const saveAuth = (user: AuthUser, token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setState({ user, token, loading: false, error: null })
  }

  const verifyAndRefresh = async (token: string) => {
    try {
      const res = await apiFetch('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        setState(prev => ({ ...prev, user: data.user }))
      } else {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setState({ user: null, token: null, loading: false, error: null })
      }
    } catch {
      // 网络错误，保留本地状态
    }
  }

  // ============ 邮箱密码登录 ============
  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      saveAuth(data.user, data.token)
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e.message }))
      throw e
    }
  }, [])

  // ============ 邮箱注册 ============
  const register = useCallback(async (username: string, email: string, password: string, phone?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const body: any = { username, email, password }
      if (phone) body.phone = phone
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      saveAuth(data.user, data.token)
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e.message }))
      throw e
    }
  }, [])

  // ============ 发送短信验证码 ============
  const sendSMSCode = useCallback(async (phone: string): Promise<{ success: boolean; waitSeconds?: number }> => {
    try {
      const res = await apiFetch('/auth/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState(prev => ({ ...prev, error: data.error }))
        return { success: false, waitSeconds: data.waitSeconds }
      }
      return { success: true }
    } catch (e: any) {
      setState(prev => ({ ...prev, error: e.message }))
      return { success: false }
    }
  }, [])

  // ============ 手机号验证码登录/注册 ============
  const phoneLogin = useCallback(async (phone: string, code: string, username?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const body: any = { phone, code }
      if (username) body.username = username
      const res = await apiFetch('/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      saveAuth(data.user, data.token)
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e.message }))
      throw e
    }
  }, [])

  // ============ 微信登录 ============
  const wechatLogin = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      // Step 1: 获取微信授权配置
      const configRes = await apiFetch('/auth/wechat-auth')
      const config = await configRes.json()

      if (config.demo) {
        // 演示模式：直接调用模拟回调
        const demoRes = await apiFetch(`${config.demoAuthUrl}`)
        const data = await demoRes.json()
        if (!demoRes.ok) throw new Error(data.error || '微信登录失败')
        saveAuth(data.user, data.token)
        return
      }

      // 生产模式：跳转到微信授权页
      window.location.href = config.authUrl
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e.message }))
      throw e
    }
  }, [])

  // ============ QQ登录 ============
  const qqLogin = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const configRes = await apiFetch('/auth/qq-auth')
      const config = await configRes.json()

      if (config.demo) {
        // 演示模式
        const demoRes = await apiFetch(`${config.demoAuthUrl}`)
        const data = await demoRes.json()
        if (!demoRes.ok) throw new Error(data.error || 'QQ登录失败')
        saveAuth(data.user, data.token)
        return
      }

      // 生产模式：跳转到 QQ 授权页
      window.location.href = config.authUrl
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e.message }))
      throw e
    }
  }, [])

  // ============ OAuth 回调处理 ============
  const handleOAuthCallback = useCallback(async (code: string, provider: 'wechat' | 'qq') => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const endpoint = provider === 'wechat' ? '/auth/wechat-auth' : '/auth/qq-auth'
      const res = await apiFetch(`${endpoint}?code=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `${provider}登录失败`)
      saveAuth(data.user, data.token)
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e.message }))
      throw e
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setState({ user: null, token: null, loading: false, error: null })
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const refreshUser = useCallback(async () => {
    if (state.token) {
      await verifyAndRefresh(state.token)
    }
  }, [state.token])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        phoneLogin,
        sendSMSCode,
        wechatLogin,
        qqLogin,
        handleOAuthCallback,
        logout,
        clearError,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ============ Hook ============
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用')
  }
  return ctx
}

export default AuthContext
