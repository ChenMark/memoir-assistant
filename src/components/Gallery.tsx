import { useState, useEffect, useRef, useCallback } from 'react'
import { MemoirSDK, MemoirPhoto } from '../utils/sdk'

function getSDK(): MemoirSDK {
  return (window as any)._memoirSDK as MemoirSDK
}

export default function Gallery() {
  const [photos, setPhotos] = useState<MemoirPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewPhoto, setPreviewPhoto] = useState<MemoirPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [filter, setFilter] = useState('')

  const loadPhotos = useCallback(() => {
    const sdk = getSDK()
    setPhotos(sdk.getPhotos().sort((a, b) => b.uploadedAt - a.uploadedAt))
  }, [])

  useEffect(() => {
    loadPhotos()
    const handler = () => loadPhotos()
    window.addEventListener('memoir-photos-updated', handler)
    return () => window.removeEventListener('memoir-photos-updated', handler)
  }, [loadPhotos])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setProgress(0)
    setCloudStatus('uploading')

    const sdk = getSDK()
    let uploaded = 0

    for (const file of Array.from(files)) {
      try {
        const photo = await sdk.uploadPhoto(file, (pct) => {
          setProgress(Math.round(((uploaded + pct / 100) / files.length) * 100))
        })
        uploaded++
        setProgress(Math.round((uploaded / files.length) * 100))
      } catch (err: any) {
        console.error('上传失败:', err)
        setCloudStatus('error')
      }
    }

    setUploading(false)
    setProgress(100)
    setCloudStatus('success')
    loadPhotos()
    if (fileRef.current) fileRef.current.value = ''

    // 通知其他组件照片已更新
    window.dispatchEvent(new CustomEvent('memoir-photos-updated'))
  }

  const handleDelete = (photo: MemoirPhoto) => {
    if (!confirm(`确定要删除「${photo.name}」吗？`)) return
    const photos = getSDK().getPhotos().filter(p => p.id !== photo.id)
    localStorage.setItem('memoir_photos', JSON.stringify(photos))
    loadPhotos()
  }

  const openPreview = (photo: MemoirPhoto) => {
    setPreviewPhoto(photo)
    setPreviewUrl(photo.url)
  }

  const closePreview = () => {
    setPreviewUrl(null)
    setPreviewPhoto(null)
  }

  const filtered = filter
    ? photos.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()) || p.id.includes(filter))
    : photos

  const totalSize = photos.reduce((sum, p) => sum + p.size, 0)
  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>🖼️ 回忆相册</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="搜索照片..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, width: 160 }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ padding: '8px 20px', background: uploading ? '#94a3b8' : 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
          > {uploading ? `上传中 ${progress}%` : '上传照片'}</button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* 上传进度条 */}
      {uploading && (
        <div style={{ marginBottom: 20, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 16, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span>正在上传到云端... <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{progress}%</span></span>
          </div>
          <div style={{ height: 6, background: '#e8d8b8', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* 统计信息 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
        <span>共 {photos.length} 张照片</span>
        <span>·</span>
        <span>总计 {formatSize(totalSize)}</span>
        {cloudStatus === 'success' && <span style={{ color: 'var(--success)' }}> 云端上传成功</span>}
        {cloudStatus === 'error' && <span style={{ color: 'var(--danger)' }}> 部分上传失败</span>}
      </div>

      {/* 照片网格 */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}></div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>还没有照片，点击「上传照片」开始</div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontSize: 14 }}
          >上传第一张照片</button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
        }}>
          {filtered.map(photo => (
            <div
              key={photo.id}
              onClick={() => openPreview(photo)}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow)',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ width: '100%', height: 160, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img
                  src={photo.url}
                  alt={photo.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{photo.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(photo.uploadedAt).toLocaleDateString('zh-CN')}</span>
                  <span>{formatSize(photo.size)}</span>
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(photo) }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.5)', color: '#fff',
                  border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer',
                }}
              >删除</button>
            </div>
          ))}
        </div>
      )}

      {/* 预览弹窗 */}
      {previewUrl && previewPhoto && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={closePreview}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <img src={previewUrl} alt={previewPhoto.name} style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }} />
            <div style={{ color: '#fff', textAlign: 'center', marginTop: 12, fontSize: 13 }}>{previewPhoto.name}</div>
            <button
              onClick={closePreview}
              style={{
                position: 'absolute', top: -12, right: -12,
                background: '#fff', border: 'none', borderRadius: '50%',
                width: 32, height: 32, fontSize: 18, cursor: 'pointer', boxShadow: 'var(--shadow-lg)',
              }}
            >✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
