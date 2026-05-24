import { useState, useLayoutEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Drafts from './components/Drafts'
import Gallery from './components/Gallery'
import Friends from './components/Friends'
import Settings from './components/Settings'
import { createSDK, MemoirSDK } from './utils/sdk'

const sdk: MemoirSDK = createSDK({
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  ossBucket: import.meta.env.VITE_OSS_BUCKET,
  ossRegion: import.meta.env.VITE_OSS_REGION,
  ossEndpoint: import.meta.env.VITE_OSS_ENDPOINT,
  signMode: import.meta.env.VITE_TELECOM_SIGN_MODE || 'hmac',
  telecomAppId: import.meta.env.VITE_TELECOM_APP_ID,
  encryptionKey: import.meta.env.VITE_ENCRYPTION_KEY || 'memoir-default-key',
})

// 将 SDK 挂载到 window，方便各组件访问
;(window as any)._memoirSDK = sdk
;(window as any)._memoirBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const navItems = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/drafts', label: '草稿', icon: '📝' },
  { path: '/gallery', label: '相册', icon: '🖼️' },
  { path: '/friends', label: '亲友', icon: '👥' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

export default function App() {
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

  return (
    <BrowserRouter>
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
          </nav>
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)' }}>
            v1.0.0 · 忆往昔团队
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh' }}>
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
          </div>

          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/drafts" element={<Drafts />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
