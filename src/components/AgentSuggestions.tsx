/**
 * Dashboard Agent 建议小部件
 * 根据用户数据主动生成提示
 */
import { useEffect, useState } from 'react'

interface Stats {
  memoirCount: number
  photoCount: number
  friendCount: number
  hobbyCount: number
}

interface Suggestion {
  text: string
  action: string
}

export default function AgentSuggestions() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('memoir_auth_token')
    if (!token) return

    // 并行获取各模块数量
    Promise.all([
      fetch('/api/v1/memoir?limit=1', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ pagination: { total: 0 } })),
      fetch('/api/v1/memoir/gallery?limit=1', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ pagination: { total: 0 } })),
      fetch('/api/v1/friend', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ friends: [] })),
      fetch('/api/v1/hobby?limit=1', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ hobbies: [] })),
    ]).then(([mem, gal, fri, hob]) => {
      setStats({
        memoirCount: mem.pagination?.total || mem.data?.length || 0,
        photoCount: gal.pagination?.total || gal.data?.length || 0,
        friendCount: fri.friends?.length || 0,
        hobbyCount: hob.hobbies?.length || 0,
      })
    }).catch(() => {})
  }, [])

  if (!visible || !stats) return null

  const suggestions = generateSuggestions(stats)

  if (suggestions.length === 0) return null

  return (
    <div style={{
      marginTop: 24,
      padding: 20,
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      borderRadius: 16,
      color: '#fff',
      position: 'relative',
    }}>
      <button
        onClick={() => setVisible(false)}
        style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer' }}
      >✕</button>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        🤖 忆往昔小助手建议
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => { window.location.href = s.action }}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >{s.text}</button>
        ))}
      </div>
    </div>
  )
}

function generateSuggestions(s: Stats): Suggestion[] {
  const items: Suggestion[] = []

  if (s.memoirCount === 0) {
    items.push({ text: '📝 写下您的第一篇回忆录吧', action: '/drafts' })
  }
  if (s.photoCount === 0) {
    items.push({ text: '📷 用手机拍几张老照片，我能帮您整理', action: '/capture' })
  } else if (s.photoCount < 5) {
    items.push({ text: `🖼️ 已有${s.photoCount}张照片，要再拍一些吗？`, action: '/capture' })
  }
  if (s.friendCount === 0) {
    items.push({ text: '👥 添加家人和朋友，构建您的家族树', action: '/friends' })
  }
  if (s.hobbyCount === 0) {
    items.push({ text: '🎵 记录您喜欢的金曲和电影', action: '/hobbies' })
  }
  if (s.memoirCount >= 3) {
    items.push({ text: `🤖 试试和AI助手聊聊，我能帮您写出${s.memoirCount}篇回忆录的合集`, action: '/agent' })
  }

  return items.slice(0, 3)
}
