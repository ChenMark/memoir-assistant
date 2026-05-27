import { useState, useLayoutEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Dashboard from './components/Dashboard'
import Drafts from './components/Drafts'
import Gallery from './components/Gallery'
import Friends from './components/Friends'
import Settings from './components/Settings'
import Login from './components/Login'
import UserManagement from './components/UserManagement'
import AIInterview from './components/AIInterview'
import { createSDK, MemoirSDK } from './utils/sdk'

const sdk: MemoirSDK = createSDK({})

// 将 SDK 挂载到 window，方便各组件访问
;(window as any)._memoirSDK = sdk
;(window as any)._memoirBackendUrl = ''  // 使用相对路径 /api/，无需指定域名

const navItems = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/drafts', label: '草稿', icon: '📝' },
  { path: '/gallery', label: '相册', icon: '🖼️' },
  { path: '/friends', label: '亲友', icon: '👥' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

// ============ 路由守卫 ============
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>加载中...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// ============ 应用主体 ============
function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 全局快捷键：Ctrl+S 保存当前草稿
  useLayoutEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('memoir-save-draft'))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.3)', zIndex: 999,
          }}
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className="sidebar"
        style={{
          width: 220,
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed',
          top: 0, left: sidebarOpen ? 0 : -240,
          bottom: 0, zIndex: 1000,
          transition: 'left 0.25s ease',
          boxShadow: sidebarOpen ? '2px 0 12px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>忆往昔</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>AI 回忆录助手</p>
        </div>

        {/* 用户信息 */}
        {user && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <NavLink
              to="/account"
              onClick={closeSidebar}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0', textDecoration: 'none', color: 'inherit',
                borderRadius: 'var(--radius)',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, fontWeight: 600, flexShrink: 0,
              }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.username}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email}
                </div>
              </div>
            </NavLink>
          </div>
        )}

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 'var(--radius)',
                marginBottom: 4, fontSize: 14, fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--primary)' : 'var(--text)',
                background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {/* 账户管理导航 */}
          <NavLink
            to="/account"
            onClick={closeSidebar}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 'var(--radius)',
              marginBottom: 4, fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--primary)' : 'var(--text)',
              background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
              textDecoration: 'none', transition: 'all 0.15s',
            })}
          >
            <span style={{ fontSize: 18 }}>👤</span>
            账户管理
          </NavLink>
        </nav>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>🚪</span> 退出登录
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            v1.1.0 · 忆往昔团队
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" style={{ flex: 1, marginLeft: 220, minHeight: '100vh' }}>
        {/* Top bar (mobile) */}
        <div style={{
          display: 'none',
          padding: '12px 20px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 100,
        }} className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
              color: 'var(--text)',
            }}
          >☰</button>
          <span style={{ fontWeight: 600, fontSize: 16 }}>忆往昔</span>
          {user && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
              {user.username}
            </span>
          )}
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
          <Routes>
            {/* 受保护的路由 */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/interview" element={<ProtectedRoute><AIInterview /></ProtectedRoute>} />
            <Route path="/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
            <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />

            {/* 公开路由 */}
            <Route path="/login" element={<Login />} />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

// ============ 根组件 ============
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  )
}
