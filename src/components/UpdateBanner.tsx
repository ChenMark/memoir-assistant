/**
 * OTA 更新横幅 — 检测到新版本时在顶部显示更新提示
 */
import { useEffect, useState } from 'react'

interface UpdateBannerProps {
  remoteVersion: string | null
  forceUpdate: boolean
  onDismiss: () => void
  onApply: () => void
}

export default function UpdateBanner({ remoteVersion, forceUpdate, onDismiss, onApply }: UpdateBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 延迟一点展示动画效果
    const t = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: visible ? 0 : -60,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
        transition: 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <span style={{ fontSize: 16 }}>✨</span>
      <span>
        新版本 <strong>v{remoteVersion}</strong> 可用
        {forceUpdate && '（必须更新）'}
      </span>
      <button
        onClick={onApply}
        style={{
          padding: '4px 16px',
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        立即更新
      </button>
      {!forceUpdate && (
        <button
          onClick={onDismiss}
          aria-label="关闭"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
            cursor: 'pointer',
            marginLeft: -8,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
