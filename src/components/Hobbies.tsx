import { useState, useEffect, useCallback } from 'react'

const API = '/api/hobby'

interface HobbyItem {
  id: string
  category: string
  title: string
  description: string
  rating: number | null
  tags: string[]
  year: string | null
  link: string | null
  imageKey: string | null
  createdAt: string
}

const CATEGORIES = [
  { id: 'music', label: '金曲', icon: '🎵' },
  { id: 'movie', label: '电影', icon: '🎬' },
  { id: 'sport', label: '比赛', icon: '🏆' },
  { id: 'custom', label: '自定义', icon: '✨' },
]

function getToken() {
  return localStorage.getItem('memoir_auth_token')
}

function authFetch(url: string, options: RequestInit = {}) {
  const token = getToken()
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  })
}

function RatingStars({ rating, onRate }: { rating: number | null; onRate?: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => onRate?.(star)}
          style={{
            fontSize: 16,
            cursor: onRate ? 'pointer' : 'default',
            color: rating && star <= rating ? '#f59e0b' : '#d1d5db',
            transition: 'color 0.15s',
          }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default function Hobbies() {
  const [activeTab, setActiveTab] = useState('music')
  const [hobbies, setHobbies] = useState<HobbyItem[]>([])
  const [loading, setLoading] = useState(false)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [rating, setRating] = useState<number>(0)
  const [year, setYear] = useState('')
  const [link, setLink] = useState('')
  const [tags, setTags] = useState('')

  const loadHobbies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API}?category=${activeTab}`)
      if (res.ok) {
        const data = await res.json()
        setHobbies(data.hobbies || [])
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { loadHobbies() }, [loadHobbies])

  const resetForm = () => {
    setEditId(null)
    setTitle('')
    setDesc('')
    setRating(0)
    setYear('')
    setLink('')
    setTags('')
    setShowForm(false)
  }

  const openEdit = (item: HobbyItem) => {
    setEditId(item.id)
    setTitle(item.title)
    setDesc(item.description)
    setRating(item.rating || 0)
    setYear(item.year || '')
    setLink(item.link || '')
    setTags(item.tags?.join(', ') || '')
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    const body = {
      category: activeTab,
      title: title.trim(),
      description: desc.trim(),
      rating: rating || null,
      year: year || null,
      link: link || null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }
    const url = editId ? `${API}/${editId}` : API
    const method = editId ? 'PUT' : 'POST'
    const res = await authFetch(url, { method, body: JSON.stringify(body) })
    if (res.ok) {
      resetForm()
      loadHobbies()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return
    await authFetch(`${API}/${id}`, { method: 'DELETE' })
    loadHobbies()
  }

  const currentCat = CATEGORIES.find((c) => c.id === activeTab)!

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
        ❤️ 我的爱好
      </h2>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveTab(cat.id); resetForm() }}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: activeTab === cat.id ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: activeTab === cat.id ? 'rgba(99,102,241,0.08)' : 'var(--bg-card)',
              color: activeTab === cat.id ? 'var(--primary)' : 'var(--text)',
              fontSize: 14,
              fontWeight: activeTab === cat.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* 添加按钮 */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          style={{
            padding: '8px 20px',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          ＋ 添加{currentCat.label}
        </button>
      </div>

      {/* 表单 */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius)',
          padding: 20, marginBottom: 24, boxShadow: 'var(--shadow)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${currentCat.label}名称`}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
              />
              <RatingStars rating={rating || null} onRate={setRating} />
            </div>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="描述/感想..."
              rows={2}
              style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="年份"
                style={{ width: 100, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
              />
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="链接(URL)"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
              />
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="标签(逗号分隔)"
                style={{ width: 180, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} style={btnStyle('#e5e7eb', '#333')}>取消</button>
              <button onClick={handleSubmit} style={btnStyle('var(--primary)', '#fff')}>
                {editId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>加载中...</div>
      ) : hobbies.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 64,
          background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{currentCat.icon}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            还没有{currentCat.label}记录，点击上方按钮添加
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {hobbies.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                padding: 16,
                boxShadow: 'var(--shadow)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{item.title}</div>
                  {item.year && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>📅 {item.year}</div>}
                </div>
                <RatingStars rating={item.rating} />
              </div>
              {item.description && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
                  {item.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {item.tags?.map((t) => (
                  <span key={t} style={{ padding: '2px 8px', background: 'rgba(99,102,241,0.08)', borderRadius: 10, fontSize: 11, color: 'var(--primary)' }}>
                    {t}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener"
                    style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>
                    🔗 链接
                  </a>
                )}
                <button onClick={() => openEdit(item)} style={actionStyle}>编辑</button>
                <button onClick={() => handleDelete(item.id)} style={{ ...actionStyle, color: 'var(--danger)' }}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '8px 20px', background: bg, color, border: 'none',
  borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500,
})

const actionStyle: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)',
}
