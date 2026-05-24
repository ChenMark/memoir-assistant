import { useState, useEffect, useCallback } from 'react'
import { MemoirSDK, Friend } from '../utils/sdk'

const STORAGE_KEY_FRIENDS = 'memoir_friends'

function getSDK(): MemoirSDK {
  return (window as any)._memoirSDK as MemoirSDK
}

export default function Friends() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [backupResult, setBackupResult] = useState<{ drafts: number; photos: number; friends: number } | null>(null)

  const loadFriends = useCallback(() => {
    const sdk = getSDK()
    setFriends(sdk.getFriends())
  }, [])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  const handleAdd = () => {
    if (!name.trim()) return
    const sdk = getSDK()
    const friend: Friend = {
      id: `friend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      avatar: avatarUrl.trim() || undefined,
      addedAt: Date.now(),
    }
    sdk.saveFriend(friend)
    setName('')
    setAvatarUrl('')
    setShowAdd(false)
    loadFriends()
  }

  const handleDelete = (id: string) => {
    if (!confirm('确定要移除此亲友吗？')) return
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_FRIENDS) || '[]')
    const filtered = list.filter((f: Friend) => f.id !== id)
    localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(filtered))
    loadFriends()
  }

  const handleBackup = async () => {
    setBackingUp(true)
    setBackupResult(null)
    try {
      const sdk = getSDK()
      const result = await sdk.backupToCloud()
      setBackupResult(result)
    } catch (e: any) {
      alert(`备份失败：${e.message}`)
    } finally {
      setBackingUp(false)
    }
  }

  const handleRestore = async () => {
    if (!confirm('从云端恢复会覆盖本地数据，确定继续吗？')) return
    setRestoring(true)
    try {
      const sdk = getSDK()
      const result = await sdk.restoreFromCloud()
      setBackupResult(result)
      loadFriends()
    } catch (e: any) {
      alert(`恢复失败：${e.message}`)
    } finally {
      setRestoring(false)
    }
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>👥 亲友共享</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleBackup}
            disabled={backingUp}
            style={{ padding: '8px 16px', background: backingUp ? '#94a3b8' : 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
          >☁️ {backingUp ? '备份中...' : '云端备份'}</button>
          <button
            onClick={handleRestore}
            disabled={restoring}
            style={{ padding: '8px 16px', background: restoring ? '#94a3b8' : 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
          >🔄 {restoring ? '恢复中...' : '云端恢复'}</button>
          <button
            onClick={() => setShowAdd(true)}
            style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
          >＋ 添加亲友</button>
        </div>
      </div>

      {/* 备份/恢复结果 */}
      {backupResult && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#15803d' }}>
          ✅ 操作完成：备份/恢复了 {backupResult.drafts} 篇草稿、{backupResult.photos} 张照片、{backupResult.friends} 位亲友
        </div>
      )}

      {/* 添加亲友弹窗 */}
      {showAdd && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 28, width: 400, maxWidth: '90vw', boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20 }}>添加亲友</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>姓名 <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  placeholder="输入亲友姓名"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>头像链接（可选）</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => setShowAdd(false)}
                  style={{ padding: '8px 20px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
                >取消</button>
                <button
                  onClick={handleAdd}
                  disabled={!name.trim()}
                  style={{ padding: '8px 20px', background: name.trim() ? 'var(--primary)' : '#94a3b8', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
                >添加</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 亲友列表 */}
      {friends.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>还没有添加亲友，一起分享回忆吧</div>
          <button
            onClick={() => setShowAdd(true)}
            style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14 }}
          >添加第一位亲友</button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {friends.map(friend => (
            <div
              key={friend.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow)',
                padding: 20,
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 20, flexShrink: 0,
              }}>
                {friend.avatar ? (
                  <img src={friend.avatar} alt={friend.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  friend.name.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{friend.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>添加于 {formatTime(friend.addedAt)}</div>
              </div>
              <button
                onClick={() => handleDelete(friend.id)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, padding: 4 }}
                title="移除"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
