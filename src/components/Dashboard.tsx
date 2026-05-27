import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MemoirSDK } from '../utils/sdk'

function getSDK(): MemoirSDK {
  return (window as any)._memoirSDK as MemoirSDK
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ draftCount: 0, photoCount: 0, friendCount: 0, totalWords: 0, lastEdited: 0 })
  const [recentDrafts, setRecentDrafts] = useState<any[]>([])
  const [cloudStatus, setCloudStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  const loadStats = useCallback(() => {
    const sdk = getSDK()
    setStats(sdk.getStats())
    try {
      const raw = localStorage.getItem('memoir_drafts') || '[]'
      const drafts = JSON.parse(raw)
      setRecentDrafts(drafts.sort((a: any, b: any) => b.updatedAt - a.updatedAt).slice(0, 5))
    } catch {
      setRecentDrafts([])
    }
  }, [])

  useEffect(() => {
    loadStats()

    // 每 5 秒刷新一次统计
    const timer = setInterval(loadStats, 5000)
    return () => clearInterval(timer)
  }, [loadStats])

  // 检测云端连通性
  useEffect(() => {
    const checkCloud = async () => {
      try {
        const sdk = getSDK()
        const url = (sdk as any).storage?.backendUrl || (window as any)._memoirBackendUrl || ''
        if (!url) { setCloudStatus('offline'); return }
        const res = await fetch(`${url.replace(/\/$/, '')}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) })
        setCloudStatus(res.ok ? 'online' : 'offline')
      } catch {
        setCloudStatus('offline')
      }
    }
    checkCloud()
    const t = setInterval(checkCloud, 30000)
    return () => clearInterval(t)
  }, [])

  const formatWords = (n: number) => {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万字`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}千字`
    return `${n}字`
  }

  const formatTime = (ts: number) => {
    if (!ts) return '暂无'
    const d = new Date(ts)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const statCards = [
    { label: '回忆录草稿', value: stats.draftCount, unit: '篇', color: '#6366f1', action: () => navigate('/drafts') },
    { label: '云端照片', value: stats.photoCount, unit: '张', color: '#22c55e', action: () => navigate('/gallery') },
    { label: '亲友共享', value: stats.friendCount, unit: '人', color: '#f59e0b', action: () => navigate('/friends') },
    { label: '总字数', value: formatWords(stats.totalWords), unit: '', color: '#3b82f6', action: undefined },
  ]

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>欢迎回来 👋</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: 14 }}>
        上次编辑：{formatTime(stats.lastEdited)} · 云端状态：
        <span style={{ color: cloudStatus === 'online' ? 'var(--success)' : cloudStatus === 'offline' ? 'var(--danger)' : 'var(--warning)' }}>
          {cloudStatus === 'online' ? ' 🟢 已连接' : cloudStatus === 'offline' ? ' 🔴 未连接' : ' 🟡 检测中...'}
        </span>
      </p>

      {/* 统计卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16, marginBottom: 36,
      }}>
        {statCards.map(card => (
          <div
            key={card.label}
            onClick={card.action}
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              padding: '24px 20px',
              boxShadow: 'var(--shadow)',
              cursor: card.action ? 'pointer' : 'default',
              borderLeft: `4px solid ${card.color}`,
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => { if (card.action) (e.currentTarget.style.transform = 'translateY(-2px)') }}
            onMouseLeave={e => { (e.currentTarget.style.transform = 'translateY(0)') }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}{card.unit && <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 4 }}>{card.unit}</span>}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* 快捷操作 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/interview')}
          style={{ padding: '10px 20px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
        >🤖 开始AI引导访谈</button>
        <button
          onClick={() => navigate('/gallery')}
          style={{ padding: '10px 20px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
        >📷 上传照片</button>
        <button
          onClick={() => navigate('/friends')}
          style={{ padding: '10px 20px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
        >👥 邀请亲友</button>
      </div>

      {/* 最近草稿 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>最近草稿</h3>
        {recentDrafts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)', fontSize: 14 }}>
            还没有草稿，点击「写新回忆」开始创作 📝
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentDrafts.map(draft => (
              <div
                key={draft.id}
                onClick={() => navigate(`/drafts?id=${draft.id}`)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{draft.title || '无标题'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {draft.content?.slice(0, 50) || '暂无内容'}...
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: 16 }}>
                  {formatTime(draft.updatedAt)}
                  {draft.synced && <span style={{ color: 'var(--success)', marginLeft: 6 }}>☁️</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
