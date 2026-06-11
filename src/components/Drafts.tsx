import { useState, useEffect, useRef } from 'react'
import { MemoirSDK, MemoirDraft } from '../utils/sdk'

function getSDK(): MemoirSDK {
  return (window as any)._memoirSDK as MemoirSDK
}

export default function Drafts() {
  const [drafts, setDrafts] = useState<MemoirDraft[]>([])
  const [editing, setEditing] = useState<MemoirDraft | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [cloudSyncing, setCloudSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const loadDrafts = async () => {
    const sdk = getSDK()
    const data = await sdk.loadDrafts()
    setDrafts(data.sort((a, b) => b.updatedAt - a.updatedAt))
  }

  useEffect(() => {
    loadDrafts()
    // 监听 Ctrl+S 保存事件
    const handler = () => {
      if (editing) handleSave()
    }
    window.addEventListener('memoir-save-draft', handler)
    return () => window.removeEventListener('memoir-save-draft', handler)
  }, [editing, title, content, tags])

  const handleNew = () => {
    setEditing({
      id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: '',
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setTitle('')
    setContent('')
    setTags('')
    setTimeout(() => editorRef.current?.focus(), 50)
  }

  const handleEdit = (draft: MemoirDraft) => {
    setEditing(draft)
    setTitle(draft.title)
    setContent(draft.content)
    setTags(draft.tags.join(', '))
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const sdk = getSDK()
      const saved = await sdk.saveDraft({
        id: editing.id,
        title: title || '无标题',
        content,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      })
      setEditing(saved)
      // 保存成功后刷新列表
      await loadDrafts()
    } catch (e: any) {
      alert(`保存失败：${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这篇草稿吗？')) return
    const sdk = getSDK()
    const drafts = JSON.parse(localStorage.getItem('memoir_drafts') || '[]')
    const filtered = drafts.filter((d: MemoirDraft) => d.id !== id)
    localStorage.setItem('memoir_drafts', JSON.stringify(filtered))
    if (editing?.id === id) {
      setEditing(null)
      setTitle('')
      setContent('')
    }
    await loadDrafts()
  }

  const handleCloudSync = async () => {
    setCloudSyncing(true)
    try {
      const sdk = getSDK()
      const result = await sdk.backupToCloud()
      alert(`云端同步完成！已备份 ${result.drafts} 篇草稿`)
      await loadDrafts()
    } catch (e: any) {
      alert(`同步失败：${e.message}`)
    } finally {
      setCloudSyncing(false)
    }
  }

  const filteredDrafts = searchTerm
    ? drafts.filter(d =>
        d.title.includes(searchTerm) || d.content.includes(searchTerm) || d.tags.some(t => t.includes(searchTerm))
      )
    : drafts

  const wordCount = content.length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}> 回忆录草稿</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCloudSync}
            disabled={cloudSyncing}
            style={{ padding: '8px 16px', background: cloudSyncing ? '#94a3b8' : 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
          >☁️ {cloudSyncing ? '同步中...' : '云端同步'}</button>
          <button
            onClick={handleNew}
            style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
          >＋ 新草稿</button>
        </div>
      </div>

      {/* 搜索 */}
      <input
        type="text"
        placeholder="搜索草稿标题、内容或标签..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{
          width: '100%', padding: '10px 16px', marginBottom: 20,
          border: '1px solid var(--border)', borderRadius: 8,
          fontSize: 14, background: 'var(--bg-card)',
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* 编辑器 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20, display: 'flex', flexDirection: 'column' }}>
          <input
            type="text"
            placeholder="标题"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ fontSize: 18, fontWeight: 600, padding: '8px 0', border: 'none', borderBottom: '1px solid var(--border)', marginBottom: 12, background: 'transparent', width: '100%' }}
          />
          <textarea
            ref={editorRef}
            placeholder="开始写下你的回忆..."
            value={content}
            onChange={e => setContent(e.target.value)}
            style={{ flex: 1, minHeight: 300, padding: 0, border: 'none', fontSize: 15, lineHeight: 1.8, resize: 'vertical', background: 'transparent', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {wordCount} 字
              {editing?.synced && <span style={{ color: 'var(--success)', marginLeft: 8 }}>☁️ 已同步</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="标签（逗号分隔）"
                value={tags}
                onChange={e => setTags(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, width: 140 }}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '6px 18px', background: saving ? '#94a3b8' : 'var(--primary)', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500 }}
              >{saving ? '保存中...' : '保存 (Ctrl+S)'}</button>
            </div>
          </div>
        </div>

        {/* 草稿列表 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20, overflowY: 'auto', maxHeight: 600 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>所有草稿 ({filteredDrafts.length})</h3>
          {filteredDrafts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)', fontSize: 13 }}>
              {searchTerm ? '没有找到匹配的草稿' : '还没有草稿，点击「新草稿」开始'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredDrafts.map(draft => (
                <div
                  key={draft.id}
                  style={{ padding: '10px 12px', background: editing?.id === draft.id ? 'rgba(99,102,241,0.08)' : 'var(--bg)', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                  onClick={() => handleEdit(draft)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{draft.title || '无标题'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{draft.content?.slice(0, 40) || '暂无内容'}...</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {draft.tags.map(t => <span key={t} style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>{t}</span>)}
                      {draft.synced && <span style={{ color: 'var(--success)' }}>☁️</span>}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(draft.id) }}
                    style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}
                  >删除</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
