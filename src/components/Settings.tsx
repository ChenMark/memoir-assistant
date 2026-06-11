import { useState, useEffect } from 'react'
import { MemoirSDK } from '../utils/sdk'

function getSDK(): MemoirSDK {
  return (window as any)._memoirSDK as MemoirSDK
}

interface StorageInfo {
  drafts: number
  photos: number
  friends: number
  bytes: number
}

export default function Settings() {
  const [signMode, setSignMode] = useState('hmac')
  const [encKey, setEncKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ drafts: 0, photos: 0, friends: 0, bytes: 0 })
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    setSignMode(localStorage.getItem('memoir_cfg_signmode') || 'hmac')
    setEncKey(localStorage.getItem('memoir_cfg_enckey') || '')

    const drafts = JSON.parse(localStorage.getItem('memoir_drafts') || '[]')
    const photos = JSON.parse(localStorage.getItem('memoir_photos') || '[]')
    const friends = JSON.parse(localStorage.getItem('memoir_friends') || '[]')
    const bytes = new Blob([JSON.stringify({ drafts, photos, friends })]).size
    setStorageInfo({ drafts: drafts.length, photos: photos.length, friends: friends.length, bytes })
  }, [])

  const handleSave = () => {
    setSaving(true)
    localStorage.setItem('memoir_cfg_signmode', signMode)
    localStorage.setItem('memoir_cfg_enckey', encKey)
    const sdk = getSDK()
    if (sdk.security) (sdk.security as any).config = { ...(sdk as any).config, signMode, encryptionKey: encKey }
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }, 300)
  }

  const handleExport = () => {
    const data = {
      drafts: JSON.parse(localStorage.getItem('memoir_drafts') || '[]'),
      photos: JSON.parse(localStorage.getItem('memoir_photos') || '[]'),
      friends: JSON.parse(localStorage.getItem('memoir_friends') || '[]'),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memoir-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClearData = async () => {
    if (!confirm('确定要清空所有本地数据吗？此操作不可撤销！')) return
    setClearing(true)
    localStorage.removeItem('memoir_drafts')
    localStorage.removeItem('memoir_photos')
    localStorage.removeItem('memoir_friends')
    setTimeout(() => { setClearing(false); window.location.reload() }, 500)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        if (data.drafts) localStorage.setItem('memoir_drafts', JSON.stringify(data.drafts))
        if (data.photos) localStorage.setItem('memoir_photos', JSON.stringify(data.photos))
        if (data.friends) localStorage.setItem('memoir_friends', JSON.stringify(data.friends))
        alert('导入成功！页面将刷新。')
        window.location.reload()
      } catch {
        alert('导入失败：文件格式不正确')
      }
    }
    input.click()
  }

  const formatBytes = (b: number) => {
    if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`
    if (b > 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${b} B`
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>⚙️ 设置</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 安全配置 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}> 安全配置</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>签名算法</label>
              <select
                value={signMode}
                onChange={e => setSignMode(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-card)', minWidth: 200 }}
              >
                <option value="hmac">HMAC-SHA256（推荐）</option>
                <option value="md5">MD5（兼容模式）</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>加密密钥</label>
              <input
                type="password"
                placeholder="用于本地隐私数据加密"
                value={encKey}
                onChange={e => setEncKey(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ alignSelf: 'flex-start', padding: '8px 20px', background: saving ? '#94a3b8' : 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
            >{saved ? ' 已保存' : '保存配置'}</button>
          </div>
        </div>

        {/* 云端说明 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>☁️ 云端存储说明</h3>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div>API 端点已通过 Vercel Functions 部署：</div>
            <div style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6, marginTop: 8, fontSize: 12 }}>
              GET  /api/health{'\n'}
              POST /api/oss/sign{'\n'}
              POST /api/oss/download{'\n'}
              POST /api/oss/delete{'\n'}
              POST /api/oss/list{'\n'}
              POST /api/telecom/token
            </div>
            <div style={{ marginTop: 8 }}>请在 Vercel 后台设置以下环境变量：</div>
            <div style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6, marginTop: 4, fontSize: 12 }}>
              OSS_ACCESS_KEY_ID{'\n'}
              OSS_ACCESS_KEY_SECRET{'\n'}
              OSS_BUCKET{'\n'}
              OSS_REGION
            </div>
          </div>
        </div>

        {/* 数据管理 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>️ 数据管理</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              本地存储：{storageInfo.drafts} 篇草稿 · {storageInfo.photos} 张照片 · {storageInfo.friends} 位亲友 · 共 {formatBytes(storageInfo.bytes)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={handleExport} style={{ padding: '8px 16px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>📤 导出备份</button>
              <button onClick={handleImport} style={{ padding: '8px 16px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>📥 导入备份</button>
              <button onClick={handleClearData} disabled={clearing} style={{ padding: '8px 16px', background: clearing ? '#94a3b8' : 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13 }}> 清空数据</button>
            </div>
          </div>
        </div>

        {/* 关于 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>ℹ️ 关于</h3>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div><strong>忆往昔 回忆录助手</strong> v1.0.0</div>
            <div>基于 React + Vite + TypeScript 构建</div>
            <div>云端存储：阿里云 OSS（Vercel Functions presign）</div>
            <div>安全签名：HMAC-SHA256 / MD5</div>
            <div>隐私加密：AES-GCM（Web Crypto API）</div>
          </div>
        </div>
      </div>
    </div>
  )
}
