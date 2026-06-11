import { useState, useEffect, useCallback, useMemo } from 'react'
import { MemoirSDK, Friend } from '../utils/sdk'
import FamilyTree from './FamilyTree'

const STORAGE_KEY_FRIENDS = 'memoir_friends'

type FriendCategory = 'family' | 'classmate' | 'friend'

function getSDK(): MemoirSDK {
  return (window as any)._memoirSDK as MemoirSDK
}

const TABS: { key: FriendCategory; label: string; icon: string }[] = [
  { key: 'family', label: '家族树', icon: '' },
  { key: 'classmate', label: '同学录', icon: '' },
  { key: 'friend', label: '朋友圈', icon: '' },
]

export default function Friends() {
  const [activeTab, setActiveTab] = useState<FriendCategory>('family')
  const [friends, setFriends] = useState<Friend[]>([])
  const [showAdd, setShowAdd] = useState(false)

  // 表单状态
  const [form, setForm] = useState<{
    name: string
    avatar: string
    category: FriendCategory
    relationship: string
    generation: string
    parentId: string
    spouseId: string
    school: string
    classInfo: string
    graduationYear: string
    metAt: string
    metYear: string
    tags: string  // 逗号分隔的标签
  }>({
    name: '',
    avatar: '',
    category: 'family',
    relationship: '',
    generation: '0',
    parentId: '',
    spouseId: '',
    school: '',
    classInfo: '',
    graduationYear: '',
    metAt: '',
    metYear: '',
    tags: '',
  })

  const loadFriends = useCallback(() => {
    const sdk = getSDK()
    setFriends(sdk.getFriends())
  }, [])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  const handleAdd = () => {
    if (!form.name.trim()) return
    const sdk = getSDK()
    const friend: Friend = {
      id: `friend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: form.name.trim(),
      avatar: form.avatar.trim() || undefined,
      addedAt: Date.now(),
      category: form.category,
      ...(form.category === 'family' ? {
        relationship: form.relationship || undefined,
        generation: form.generation ? parseInt(form.generation) : 0,
        parentId: form.parentId || undefined,
        spouseId: form.spouseId || undefined,
      } : {}),
      ...(form.category === 'classmate' ? {
        school: form.school || undefined,
        classInfo: form.classInfo || undefined,
        graduationYear: form.graduationYear || undefined,
      } : {}),
      ...(form.category === 'friend' ? {
        metAt: form.metAt || undefined,
        metYear: form.metYear || undefined,
        tags: form.tags ? form.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : undefined,
      } : {}),
    }
    sdk.saveFriend(friend)
    setForm({
      name: '', avatar: '', category: 'family',
      relationship: '', generation: '0', parentId: '', spouseId: '',
      school: '', classInfo: '', graduationYear: '',
      metAt: '', metYear: '', tags: '',
    })
    setShowAdd(false)
    loadFriends()
  }

  const handleDelete = (id: string) => {
    if (!confirm('确定要移除吗？')) return
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_FRIENDS) || '[]')
    const filtered = list.filter((f: Friend) => f.id !== id)
    localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(filtered))
    loadFriends()
  }

  // 按分类过滤
  const filtered = friends.filter(f => f.category === activeTab)

  // 同学录：按学校分组
  const classmatesBySchool = activeTab === 'classmate'
    ? filtered.reduce<Record<string, Friend[]>>((acc, f) => {
        const key = f.school || '未分类'
        if (!acc[key]) acc[key] = []
        acc[key].push(f)
        return acc
      }, {})
    : {}

  // 朋友圈：按标签分组（一个人可以有多个标签）
  const friendsByTag = activeTab === 'friend'
    ? filtered.reduce<Record<string, Friend[]>>((acc, f) => {
        const tagList = f.tags && f.tags.length > 0 ? f.tags : ['未分类']
        tagList.forEach(tag => {
          if (!acc[tag]) acc[tag] = []
          // 避免同一人在同一标签下重复出现
          if (!acc[tag].find(x => x.id === f.id)) {
            acc[tag].push(f)
          }
        })
        return acc
      }, {})
    : {}

  // 收集所有已有标签（用于表单下拉选择）
  const existingTags = useMemo(() => {
    const tagSet = new Set<string>()
    friends.filter(f => f.category === 'friend' && f.tags).forEach(f => {
      f.tags!.forEach(t => tagSet.add(t))
    })
    return Array.from(tagSet).sort()
  }, [friends])

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}> 亲友管理</h2>
        <button
          onClick={() => { setForm(f => ({ ...f, category: activeTab })); setShowAdd(true) }}
          style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
        >＋ 添加</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
              fontSize: 15,
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {activeTab === 'family' ? '' : activeTab === 'classmate' ? '' : ''}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            {activeTab === 'family' ? '还没有家族成员，点击添加' : activeTab === 'classmate' ? '还没有同学记录' : '还没有朋友记录'}
          </div>
          <button
            onClick={() => { setForm(f => ({ ...f, category: activeTab })); setShowAdd(true) }}
            style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14 }}
          >添加</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 家族树：可视化树状图 */}
          {activeTab === 'family' && (
            <FamilyTree friends={filtered} onDelete={handleDelete} />
          )}

          {/* 同学录：按学校分组 */}
          {activeTab === 'classmate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(classmatesBySchool).map(([school, list]) => (
                <div key={school} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>🏫 {school}（{list.length}人）</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {list.map(f => (
                      <FriendCard key={f.id} friend={f} onDelete={handleDelete} formatTime={formatTime} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 朋友圈：按标签分组 */}
          {activeTab === 'friend' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(friendsByTag).map(([tag, list]) => (
                <div key={tag} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', background: 'var(--primary)', color: '#fff',
                      borderRadius: 16, fontSize: 13
                    }}>
                      {tag}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>({list.length}人)</span>
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {list.map(f => (
                      <FriendCard key={`${tag}-${f.id}`} friend={f} onDelete={handleDelete} formatTime={formatTime} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 添加弹窗 */}
      {showAdd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAdd(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 28, width: 480, maxWidth: '95vw', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20 }}>添加{activeTab === 'family' ? '家族成员' : activeTab === 'classmate' ? '同学' : '朋友'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 分类选择 */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>分类</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {TABS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setForm(f => ({ ...f, category: t.key }))}
                      style={{
                        padding: '6px 14px', borderRadius: 8,
                        background: form.category === t.key ? 'var(--primary)' : 'var(--bg)',
                        color: form.category === t.key ? '#fff' : 'var(--text)',
                        border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer',
                      }}
                    >{t.icon} {t.label}</button>
                  ))}
                </div>
              </div>

              {/* 姓名 */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>姓名 <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="text" placeholder="输入姓名" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
              </div>

              {/* 家族树专属字段 */}
              {form.category === 'family' && (
                <>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>关系</label>
                    <input type="text" placeholder="如：父亲、母亲、儿子" value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>世代</label>
                    <input type="number" placeholder="0=自己，-1=父母辈，+1=子女辈" value={form.generation} onChange={e => setForm(f => ({ ...f, generation: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>父节点（可选）</label>
                    <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: '#fff' }}>
                      <option value="">-- 无（作为根节点）--</option>
                      {friends.filter(f => f.category === 'family').map(f => (
                        <option key={f.id} value={f.id}>{f.name}（{f.relationship || '未设置关系'}）</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>配偶（可选）</label>
                    <select value={form.spouseId} onChange={e => setForm(f => ({ ...f, spouseId: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: '#fff' }}>
                      <option value="">-- 无 --</option>
                      {friends.filter(f => f.category === 'family' && f.id !== form.parentId).map(f => (
                        <option key={f.id} value={f.id}>{f.name}（{f.relationship || '未设置关系'}）</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* 同学录专属字段 */}
              {form.category === 'classmate' && (
                <>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>学校</label>
                    <input type="text" placeholder="学校名称" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>班级</label>
                    <input type="text" placeholder="如：高三(2)班" value={form.classInfo} onChange={e => setForm(f => ({ ...f, classInfo: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>毕业年份</label>
                    <input type="text" placeholder="如：1998" value={form.graduationYear} onChange={e => setForm(f => ({ ...f, graduationYear: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                  </div>
                </>
              )}

              {/* 朋友圈专属字段 */}
              {form.category === 'friend' && (
                <>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>标签（单位/分组）</label>
                    <input
                      type="text"
                      placeholder="如：华为公司、大学同学、棋友（多个用逗号分隔）"
                      value={form.tags}
                      onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
                    />
                    {existingTags.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>已有标签：</span>
                        {existingTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const current = form.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
                              if (!current.includes(tag)) {
                                setForm(f => ({ ...f, tags: f.tags ? `${f.tags}, ${tag}` : tag }))
                              }
                            }}
                            style={{
                              padding: '2px 10px', borderRadius: 12, border: '1px solid var(--border)',
                              background: form.tags.includes(tag) ? 'var(--primary)' : 'var(--bg)',
                              color: form.tags.includes(tag) ? '#fff' : 'var(--text)',
                              fontSize: 11, cursor: 'pointer', transition: 'all 0.15s'
                            }}
                          >{tag}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>认识地点</label>
                    <input type="text" placeholder="如：公司、健身房" value={form.metAt} onChange={e => setForm(f => ({ ...f, metAt: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>认识年份</label>
                    <input type="text" placeholder="如：2015" value={form.metYear} onChange={e => setForm(f => ({ ...f, metYear: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                  </div>
                </>
              )}

              {/* 头像链接 */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>头像链接（可选）</label>
                <input type="url" placeholder="https://..." value={form.avatar} onChange={e => setForm(f => ({ ...f, avatar: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
              </div>

              {/* 按钮 */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowAdd(false)} style={{ padding: '8px 20px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}>取消</button>
                <button onClick={handleAdd} disabled={!form.name.trim()} style={{ padding: '8px 20px', background: form.name.trim() ? 'var(--primary)' : '#94a3b8', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>添加</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 好友卡片组件 ============
function FriendCard({ friend, onDelete, formatTime }: { friend: Friend; onDelete: (id: string) => void; formatTime: (ts: number) => string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'transform 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* 头像 */}
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #b8860b, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, flexShrink: 0 }}>
        {friend.avatar ? <img src={friend.avatar} alt={friend.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} /> : friend.name.charAt(0).toUpperCase()}
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{friend.name}</div>
        {/* 家族树 */}
        {friend.category === 'family' && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {friend.relationship && <span>{friend.relationship} · </span>}
            {friend.generation !== undefined && <span>世代{friend.generation >= 0 ? '+' : ''}{friend.generation} · </span>}
            <span>添加于{formatTime(friend.addedAt)}</span>
          </div>
        )}
        {/* 同学录 */}
        {friend.category === 'classmate' && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {friend.school && <span>🏫 {friend.school} </span>}
            {friend.classInfo && <span>· {friend.classInfo} </span>}
            {friend.graduationYear && <span>· {friend.graduationYear}届</span>}
          </div>
        )}
        {/* 朋友圈 */}
        {friend.category === 'friend' && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {friend.tags && friend.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 3 }}>
                {friend.tags.map(tag => (
                  <span key={tag} style={{
                    padding: '1px 8px', borderRadius: 10, background: '#f3e8ff',
                    color: '#7c3aed', fontSize: 10, fontWeight: 500,
                    border: '1px solid #e9d5ff'
                  }}>{tag}</span>
                ))}
              </div>
            )}
            <div>
              {friend.metAt && <span>📍 {friend.metAt} </span>}
              {friend.metYear && <span>· {friend.metYear}年认识</span>}
            </div>
          </div>
        )}
      </div>

      {/* 删除 */}
      <button onClick={() => onDelete(friend.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, padding: 4 }} title="移除">✕</button>
    </div>
  )
}
