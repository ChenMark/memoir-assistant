import { useState, useEffect, useRef, useCallback } from 'react'
import { MemoirSDK, MemoirPhoto } from '../utils/sdk'

function getSDK(): MemoirSDK {
  return (window as any)._memoirSDK as MemoirSDK
}

interface UploadTask {
  id: string
  file: File
  progress: number
  status: 'pending' | 'compressing' | 'uploading' | 'syncing' | 'done' | 'error'
  photo?: MemoirPhoto
}

export default function Gallery() {
  const [photos, setPhotos] = useState<MemoirPhoto[]>([])
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewPhoto, setPreviewPhoto] = useState<MemoirPhoto | null>(null)
  const [filter, setFilter] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadPhotos = useCallback(() => {
    setPhotos(getSDK().getPhotos().sort((a, b) => b.uploadedAt - a.uploadedAt))
  }, [])

  useEffect(() => {
    loadPhotos()
    const handler = () => loadPhotos()
    window.addEventListener('memoir-photos-updated', handler)
    return () => window.removeEventListener('memoir-photos-updated', handler)
  }, [loadPhotos])

  const addFiles = async (files: FileList | File[]) => {
    const sdk = getSDK()
    const newTasks: UploadTask[] = Array.from(files).map((file) => ({
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      progress: 0,
      status: 'pending' as const,
    }))

    setTasks((prev) => [...prev, ...newTasks])

    // 逐个上传（限制并发为 2）
    const queue = [...newTasks]
    const concurrency = 2

    const processTask = async (task: UploadTask) => {
      try {
        const updateTask = (updates: Partial<UploadTask>) => {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updates } : t)))
        }

        // 压缩阶段（仅大图）
        const isLarge =
          task.file.type.startsWith('image/') && task.file.size > 500 * 1024
        if (isLarge) {
          updateTask({ status: 'compressing', progress: 5 })
        }

        const photo = await sdk.uploadAndSync(task.file, (pct) => {
          const status = pct < 8 ? 'compressing' : pct < 90 ? 'uploading' : 'syncing'
          updateTask({ progress: pct, status: status as UploadTask['status'] })
        })

        updateTask({ status: 'done', progress: 100, photo })
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'error', progress: 0 } : t)),
        )
      }
    }

    for (let i = 0; i < queue.length; i += concurrency) {
      await Promise.all(queue.slice(i, i + concurrency).map(processTask))
    }

    loadPhotos()
    window.dispatchEvent(new CustomEvent('memoir-photos-updated'))
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    addFiles(files)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleDelete = (photo: MemoirPhoto) => {
    if (!confirm(`确定要删除「${photo.name}」吗？`)) return
    const photos = getSDK().getPhotos().filter((p) => p.id !== photo.id)
    localStorage.setItem('memoir_photos', JSON.stringify(photos))
    loadPhotos()
  }

  const dismissTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
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
    ? photos.filter(
        (p) =>
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.id.includes(filter),
      )
    : photos

  const totalSize = photos.reduce((sum, p) => sum + p.size, 0)
  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'error')

  return (
    <div>
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
          }}
        >
          🖼️ 回忆相册
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="搜索照片..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              width: 160,
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={activeTasks.length > 0}
            style={{
              padding: '8px 20px',
              background: activeTasks.length > 0 ? '#94a3b8' : 'var(--primary)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            📤 上传照片
          </button>
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

      {/* 上传任务队列 */}
      {tasks.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            padding: 16,
            boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            上传队列 ({tasks.filter((t) => t.status === 'done').length}/{tasks.length})
          </div>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 16,
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {task.status === 'done'
                  ? '✅'
                  : task.status === 'error'
                    ? '❌'
                    : task.status === 'compressing'
                      ? '🗜️'
                      : '⬆️'}
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color:
                    task.status === 'error'
                      ? 'var(--danger)'
                      : task.status === 'done'
                        ? 'var(--success)'
                        : 'var(--text)',
                }}
              >
                {task.file.name}
              </span>
              <span style={{ width: 40, textAlign: 'right', color: 'var(--text-secondary)', flexShrink: 0 }}>
                {task.status === 'done' ? '完成' : task.status === 'error' ? '失败' : `${task.progress}%`}
              </span>
              {(task.status === 'done' || task.status === 'error') && (
                <button
                  onClick={() => dismissTask(task.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {/* 进度条 */}
          {activeTasks.length > 0 && (
            <div style={{ height: 6, background: '#e8d8b8', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.round(
                    tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length,
                  )}%`,
                  background: 'var(--primary)',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 统计 */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 24,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}
      >
        <span>共 {photos.length} 张照片</span>
        <span>·</span>
        <span>总计 {formatSize(totalSize)}</span>
        <span>·</span>
        <span>
          大图自动压缩 · 直传 OSS
        </span>
      </div>

      {/* 拖拽上传区域（无照片时） */}
      {filtered.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            textAlign: 'center',
            padding: 64,
            background: dragOver ? 'rgba(124,58,237,0.06)' : 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            border: dragOver ? '2px dashed #7c3aed' : '2px dashed var(--border)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>
            拖拽照片到此处
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            支持 JPG / PNG / WebP · 大图自动压缩 · 直传 OSS 对象存储
          </div>
        </div>
      ) : (
        <>
          {/* 拖拽提示条 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              height: dragOver ? 48 : 0,
              overflow: 'hidden',
              transition: 'height 0.2s',
              marginBottom: dragOver ? 16 : 0,
              background: 'rgba(124,58,237,0.06)',
              borderRadius: 'var(--radius)',
              border: dragOver ? '2px dashed #7c3aed' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#7c3aed',
              fontWeight: 500,
            }}
          >
            📥 拖拽到此添加照片
          </div>

          {/* 照片网格 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            {filtered.map((photo) => (
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
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = 'translateY(-3px)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = 'translateY(0)')
                }
              >
                <div
                  style={{
                    width: '100%',
                    height: 160,
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {photo.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      marginTop: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      {new Date(photo.uploadedAt).toLocaleDateString('zh-CN')}
                    </span>
                    <span>{formatSize(photo.size)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(photo)
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 预览弹窗 */}
      {previewUrl && previewPhoto && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closePreview}
        >
          <div
            style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt={previewPhoto.name}
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8 }}
            />
            <div
              style={{ color: '#fff', textAlign: 'center', marginTop: 12, fontSize: 13 }}
            >
              {previewPhoto.name}
            </div>
            <button
              onClick={closePreview}
              style={{
                position: 'absolute',
                top: -12,
                right: -12,
                background: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                fontSize: 18,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
