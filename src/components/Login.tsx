import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type LoginTab = 'email' | 'phone'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    login, register, phoneLogin, sendSMSCode,
    wechatLogin, qqLogin, handleOAuthCallback,
    loading, error, clearError,
  } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [tab, setTab] = useState<LoginTab>('email')

  // 邮箱登录字段
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [regPhone, setRegPhone] = useState('')

  // 手机号登录字段
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [smsCountdown, setSmsCountdown] = useState(0)
  const [smsSending, setSmsSending] = useState(false)

  const [localError, setLocalError] = useState('')
  const [demoing, setDemoing] = useState(false)
  const [thirdPartyLoading, setThirdPartyLoading] = useState<string | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 处理 OAuth 回调（微信/QQ）
  useEffect(() => {
    const code = searchParams.get('code')
    const provider = searchParams.get('provider') as 'wechat' | 'qq' | null
    if (code && provider) {
      handleOAuthCallback(code, provider)
        .then(() => navigate('/'))
        .catch(() => {})
    }
  }, [searchParams])

  // 清理倒计时
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    setLocalError('')
    clearError()
  }

  const switchTab = (newTab: LoginTab) => {
    setTab(newTab)
    setLocalError('')
    clearError()
  }

  // ============ 演示登录（自动注册+登录）===========
  const handleDemoLogin = async () => {
    setDemoing(true)
    setLocalError('')
    clearError()
    try {
      // 先尝试登录
      try {
        await login('demo@memoir.test', 'demo123456')
        navigate('/')
        return
      } catch {
        // 登录失败，尝试注册
      }
      // 注册演示账号
      await register('演示用户', 'demo@memoir.test', 'demo123456', undefined)
      // 注册后登录
      await login('demo@memoir.test', 'demo123456')
      navigate('/')
    } catch (err: any) {
      setLocalError(err.message || '演示登录失败，请手动注册')
    } finally {
      setDemoing(false)
    }
  }

  const handleSendSMS = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setLocalError('请输入有效的手机号码')
      return
    }
    setSmsSending(true)
    setLocalError('')
    clearError()
    const result = await sendSMSCode(phone)
    setSmsSending(false)
    if (result.success) {
      setSmsSent(true)
      setSmsCountdown(60)
      countdownRef.current = setInterval(() => {
        setSmsCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  // ============ 邮箱登录/注册 ===========
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    clearError()
    if (!email.trim() || !password) {
      setLocalError('请填写所有必填项')
      return
    }
    if (mode === 'register') {
      if (!username.trim()) { setLocalError('请输入用户名'); return }
      if (password !== confirmPassword) { setLocalError('两次密码不一致'); return }
      if (password.length < 6) { setLocalError('密码至少 6 个字符'); return }
      if (regPhone && !/^1[3-9]\d{9}$/.test(regPhone)) {
        setLocalError('手机号格式不正确'); return
      }
      try {
        await register(username.trim(), email.trim(), password, regPhone || undefined)
        navigate('/')
      } catch {}
    } else {
      try {
        await login(email.trim(), password)
        navigate('/')
      } catch {}
    }
  }

  // ============ 手机号验证码登录 ===========
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    clearError()
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setLocalError('请输入有效的手机号码')
      return
    }
    if (!smsCode || smsCode.length !== 6) {
      setLocalError('请输入 6 位验证码')
      return
    }
    try {
      await phoneLogin(phone, smsCode)
      navigate('/')
    } catch {}
  }

  // ============ 第三方登录 ===========
  const handleWechatLogin = async () => {
    setThirdPartyLoading('wechat')
    setLocalError('')
    clearError()
    try {
      await wechatLogin()
      navigate('/')
    } catch {}
    setThirdPartyLoading(null)
  }

  const handleQQLogin = async () => {
    setThirdPartyLoading('qq')
    setLocalError('')
    clearError()
    try {
      await qqLogin()
      navigate('/')
    } catch {}
    setThirdPartyLoading(null)
  }

  const displayError = localError || error

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ width: 440 }}>
        {/* Logo */}
        <div className="auth-header">
          <div className="auth-logo">忆</div>
          <h1>忆往昔</h1>
          <p>AI 回忆录助手</p>
        </div>

        {/* 登录方式 Tab 切换 */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'email' ? 'active' : ''}`}
            onClick={() => switchTab('email')}
          >
            邮箱登录
          </button>
          <button
            className={`auth-tab ${tab === 'phone' ? 'active' : ''}`}
            onClick={() => switchTab('phone')}
          >
            手机登录
          </button>
        </div>

        {/* 错误提示 */}
        {displayError && (
          <div className="auth-error">
            <span></span> {displayError}
          </div>
        )}

        {/* ===== 邮箱登录/注册表单 ===== */}
        {tab === 'email' && (
          <>
            {/* 登录/注册子 Tab */}
            <div className="auth-subtabs">
              <button
                  className={`auth-subtab ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => switchMode('login')}
                >登录</button>
              <button
                  className={`auth-subtab ${mode === 'register' ? 'active' : ''}`}
                  onClick={() => switchMode('register')}
                >注册</button>
            </div>

            <form onSubmit={handleEmailSubmit} className="auth-form">
              {mode === 'register' && (
                <div className="auth-field">
                  <label htmlFor="username">用户名</label>
                  <input
                    id="username"
                    type="text"
                    placeholder="输入用户名（支持中文）"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="email">邮箱</label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="password">密码</label>
                <input
                  id="password"
                  type="password"
                  placeholder={mode === 'register' ? '至少 6 个字符' : '输入密码'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              {mode === 'register' && (
                <>
                  <div className="auth-field">
                    <label htmlFor="confirmPassword">确认密码</label>
                    <input
                      id="confirmPassword"
                      type="password"
                      placeholder="再次输入密码"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="regPhone">手机号（选填）</label>
                    <input
                      id="regPhone"
                      type="tel"
                      placeholder="输入手机号"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={loading}
              >
                {loading
                  ? (mode === 'login' ? '登录中...' : '注册中...')
                  : (mode === 'login' ? '登 录' : '注 册')
                }
              </button>
            </form>

            <div className="auth-switch">
              {mode === 'login' ? (
                <>还没有账号？ <button onClick={() => switchMode('register')}>立即注册</button></>
              ) : (
                <>已有账号？ <button onClick={() => switchMode('login')}>去登录</button></>
              )}
            </div>
          </>
        )}

        {/* ===== 手机号验证码登录 ===== */}
        {tab === 'phone' && (
          <>
            <form onSubmit={handlePhoneSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="phone">手机号</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="输入手机号"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoComplete="tel"
                  maxLength={11}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="smsCode">验证码</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    id="smsCode"
                    type="text"
                    placeholder="6位验证码"
                    value={smsCode}
                    onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    maxLength={6}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="sms-btn"
                    onClick={handleSendSMS}
                    disabled={smsSending || smsCountdown > 0 || !phone}
                  >
                    {smsSending || smsCountdown > 0
                      ? `${smsCountdown || 60}s`
                      : smsSent ? '重新获取' : '获取验证码'
                    }
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={loading}
              >
                {loading ? '验证中...' : '登 录'}
              </button>
            </form>

            <div className="auth-switch">
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                未注册的手机号将自动创建账户
              </p>
              <button onClick={() => switchTab('email')}>
                使用邮箱登录
              </button>
            </div>
          </>
        )}

        {/* ===== 第三方登录 ===== */}
        <div className="third-party-login">
          <div className="third-party-divider">
            <span>其他登录方式</span>
          </div>
          <div className="third-party-buttons">
            {/* 演示登录按钮 */}
            <button
              className="social-btn demo"
              onClick={handleDemoLogin}
              disabled={loading || demoing}
              title="演示登录（自动创建演示账号）"
            >
              {demoing ? '登录中...' : '演示登录'}
            </button>
            <button
              className="social-btn wechat"
              onClick={handleWechatLogin}
              disabled={loading || thirdPartyLoading === 'wechat'}
              title="微信登录"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-1.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/>
              </svg>
              <span>微信</span>
            </button>
            <button
              className="social-btn qq"
              onClick={handleQQLogin}
              disabled={loading || thirdPartyLoading === 'qq'}
              title="QQ登录"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-2.234.689-.464.194-.69.776-.69 1.087 0 .312.22.498.498 0 0 4.194-1.185 8.946-1.185 4.752 0 8.946 1.185 8.946 1.185.278 0 .498-.178.498-.49 0-.311-.226-.893-.69-1.087-.463-.194-2.234-.689-2.234-.689 2.084-1.77 1.904-3.967 1.904-3.967.846 1.588 1.634 2.072 1.748 2.072.111 0 .281-.36.281-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.293 3.364 14.268 2 12.003 2z"/>
              </svg>
              <span>QQ</span>
            </button>
          </div>
          <div className="third-party-hint">
            点击「演示登录」即可无需注册直接进入系统
          </div>
        </div>
      </div>
    </div>
  )
}
