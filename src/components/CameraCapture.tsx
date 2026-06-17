/**
 * 摄像头采集组件 — 老年友好大字体界面
 * 支持拍照(10张) / 录像(60秒) + 实时语音转文字
 * 适配 Android 平板横屏双栏
 */
import { useState, useMemo } from 'react'
import { useCamera } from '../hooks/useCamera'
import { useSpeechCapture } from '../hooks/useSpeechCapture'
import { useDevice } from '../hooks/useDevice'

type Mode = 'idle' | 'photo' | 'video' | 'review'

export default function CameraCapture({ onClose }: { onClose: () => void }) {
  const cam = useCamera()
  const speech = useSpeechCapture()
  const device = useDevice()
  const isTablet = useMemo(
    () => device.type === 'tablet' || device.type === 'tablet-small',
    [device.type]
  )
  const [mode, setMode] = useState<Mode>('idle')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [prevMode, setPrevMode] = useState<'photo' | 'video'>('photo')
  const [uploadProgress, setUploadProgress] = useState('')

  const enterPhoto = () => {
    cam.startCamera()
    cam.reset()
    speech.reset()
    setMode('photo')
  }
  const enterVideo = () => {
    cam.startCamera().then((stream) => {
      if (stream) {
        cam.reset()
        speech.reset()
        setMode('video')
      }
    })
  }

  const handleStartRecord = () => {
    cam.startRecording()
    speech.startListening()
  }
  const handleStopRecord = () => {
    cam.stopRecording()
    speech.stopListening()
  }

  // 保存到云端（使用 prevMode 判断照片/视频）
  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const ossKeys: string[] = []
      const token = localStorage.getItem('memoir_auth_token') || ''

      if (prevMode === 'photo') {
        const total = cam.photos.length
        // Promise.all 并行上传
        const results = await Promise.allSettled(
          cam.photos.map(async (photo, i) => {
            const key = `uploads/capture/${Date.now()}_${photo.id}.jpg`
            setUploadProgress(`上传中 ${i + 1}/${total}...`)
            const signRes = await fetch(`/api/v1/oss/sign`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ key, contentType: 'image/jpeg' }),
            })
            if (signRes.ok) {
              const { uploadUrl } = await signRes.json()
              await fetch(uploadUrl, { method: 'PUT', body: photo.blob, headers: { 'Content-Type': 'image/jpeg' } })
              return key
            }
            return null
          }),
        )
        results.forEach((r) => { if (r.status === 'fulfilled' && r.value) ossKeys.push(r.value) })
      } else if (prevMode === 'video' && cam.video.blob) {
        setUploadProgress('上传中...')
        const key = `uploads/capture/${Date.now()}_video.webm`
        const signRes = await fetch(`/api/v1/oss/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key, contentType: 'video/webm' }),
        })
        if (signRes.ok) {
          const { uploadUrl } = await signRes.json()
          await fetch(uploadUrl, { method: 'PUT', body: cam.video.blob, headers: { 'Content-Type': 'video/webm' } })
          ossKeys.push(key)
        }
      }

      // 创建会话记录
      const sessionRes = await fetch('/api/v1/capture/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: prevMode,
          date: new Date().toISOString().slice(0, 10),
          tags: ['相机采集'],
        }),
      })
      if (sessionRes.ok) {
        const { session } = await sessionRes.json()
        await fetch(`/api/v1/capture/session/${session.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            ossKeys,
            transcript: speech.transcript || speech.stopListening() || '',
            duration: prevMode === 'video' ? cam.video.duration : undefined,
            itemCount: prevMode === 'photo' ? ossKeys.length : 1,
          }),
        })
      }

      // 同步到相册：每张照片/视频写入 Gallery 记录
      const today = new Date().toISOString().slice(0, 10)
      const galleryResults = await Promise.allSettled(
        ossKeys.map((key) =>
          fetch('/api/v1/memoir/gallery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              ossKey: key,
              caption: speech.transcript ? speech.transcript.substring(0, 100) : `相机采集 ${today}`,
              date: today,
              tags: ['相机采集'],
            }),
          }).then(async (r) => (r.ok ? r.json() : null)),
        ),
      )
      // 将新照片 ID 存入 localStorage，供 Gallery 直接加载
      const galleryIds = galleryResults
        .filter((r): r is PromiseFulfilledResult<{ item?: { id: string } }> => r.status === 'fulfilled' && r.value?.item?.id != null)
        .map((r) => r.value!.item!.id)
      if (galleryIds.length > 0) {
        const existingIds = JSON.parse(localStorage.getItem('memoir_gallery_ids') || '[]')
        localStorage.setItem('memoir_gallery_ids', JSON.stringify([...galleryIds, ...existingIds].slice(0, 500)))
      }

      setSaveMsg(`✅ 保存成功！${ossKeys.length} 个文件`)
      setUploadProgress('')
      setTimeout(() => onClose(), 1000)
    } catch (err) {
      setSaveMsg(`❌ 保存失败: ${(err as Error).message}`)
      setUploadProgress('')
    } finally {
      setSaving(false)
    }
  }

  const goReview = () => {
    if (mode === 'video') speech.stopListening()
    setPrevMode(mode as 'photo' | 'video')
    setMode('review')
  }

  // ===== 拍照模式 — 平板双栏 / 手机单栏 =====
  if (mode === 'photo') {
    return (
      <div style={fullScreen}>
        {isTablet ? (
          // 平板横屏：左侧取景 60% / 右侧控制 40%
          <div style={{ display: 'flex', flex: 1, background: '#000' }}>
            <div style={{ position: 'relative', flex: '0 0 60%' }}>
              <video ref={cam.videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={countBadge}>📷 {cam.photos.length}/10</div>
              <button onClick={cam.flipCamera} style={{ ...iconBtn('#fff', 'rgba(0,0,0,0.5)'), right: 60 }} aria-label="翻转镜头">🔄</button>
              <button onClick={() => { cam.stopCamera(); setMode('idle') }} style={iconBtn('#fff', 'rgba(255,0,0,0.4)')} aria-label="关闭摄像头">✕</button>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-card)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>已拍 {cam.photos.length} / 10 张</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {cam.photos.map((p, i) => (
                  <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#f0f0f0' }}>
                    <img src={p.url} alt={`照片 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => cam.takePhoto()} disabled={cam.photos.length >= 10}
                  style={bigBtn('#fff', '#1a1a2e', cam.photos.length >= 10 ? '#444' : '#6366f1')}>📸 拍照</button>
                <button onClick={goReview} disabled={cam.photos.length === 0}
                  style={bigBtn('#fff', '#1a1a2e', cam.photos.length > 0 ? '#22c55e' : '#444')}>✓ 预览保存</button>
              </div>
            </div>
          </div>
        ) : (
          // 手机：单列
          <>
            <div style={{ position: 'relative', flex: 1 }}>
              <video ref={cam.videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={countBadge}>📷 {cam.photos.length}/10</div>
              <button onClick={cam.flipCamera} style={{ ...iconBtn('#fff', 'rgba(0,0,0,0.5)'), right: 60 }} aria-label="翻转镜头">🔄</button>
              <button onClick={() => { cam.stopCamera(); setMode('idle') }} style={iconBtn('#fff', 'rgba(255,0,0,0.4)')} aria-label="关闭摄像头">✕</button>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: 16, background: '#000' }}>
              <button onClick={() => cam.takePhoto()} disabled={cam.photos.length >= 10}
                style={bigBtn('#fff', '#1a1a2e', cam.photos.length >= 10 ? '#444' : '#6366f1')}>📸 拍照</button>
              <button onClick={goReview} disabled={cam.photos.length === 0}
                style={bigBtn('#fff', '#1a1a2e', cam.photos.length > 0 ? '#22c55e' : '#444')}>✓ 预览 ({cam.photos.length})</button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ===== 录像模式 =====
  if (mode === 'video') {
    const isRecording = cam.video.recording
    const timeLeft = cam.maxVideoSec - cam.videoTimer
    return (
      <div style={fullScreen}>
        <div style={{ position: 'relative', flex: 1 }}>
          <video ref={cam.videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {speech.interim && (
            <div style={{ position: 'absolute', bottom: 80, left: 16, right: 16, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 12, padding: 10, fontSize: 16, lineHeight: 1.5, maxHeight: 80, overflowY: 'auto' }}>
              🎤 {speech.interim}
            </div>
          )}
          <div style={countBadge}>{isRecording ? `⏺ ${timeLeft}秒` : '🎥 就绪'}</div>
          <button onClick={() => { cam.stopCamera(); setMode('idle') }} style={iconBtn('#fff', 'rgba(255,0,0,0.4)')} aria-label="关闭摄像头">✕</button>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: 16, background: '#000' }}>
          {!cam.video.blob ? (
            <>
              {!isRecording ? (
                <button onClick={handleStartRecord} style={bigBtn('#fff', '#1a1a2e', '#ef4444')}>⏺ 开始录制</button>
              ) : (
                <button onClick={handleStopRecord} style={bigBtn('#fff', '#1a1a2e', '#f59e0b')}>⏹ 停止</button>
              )}
            </>
          ) : (
            <button onClick={goReview} style={bigBtn('#fff', '#1a1a2e', '#22c55e')}>✓ 预览视频</button>
          )}
        </div>
      </div>
    )
  }

  // ===== 预览模式 =====
  if (mode === 'review') {
    return (
      <div style={{ ...fullScreen, flexDirection: 'column', background: '#1a1a2e', overflowY: 'auto' }}>
        <div style={{ padding: 20, color: '#fff' }}>
          <h2 style={{ fontSize: 22, margin: 0, marginBottom: 16 }}>📋 采集预览</h2>

          {cam.photos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {cam.photos.map((p, i) => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <img src={p.url} alt={`照片 ${i + 1}`} style={{ width: '100%', borderRadius: 8 }} />
                  <button onClick={() => cam.removePhoto(p.id)} aria-label={`删除照片 ${i + 1}`}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 12, width: 24, height: 24, fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {cam.video.url && (
            <div style={{ marginBottom: 16 }}>
              <video src={cam.video.url} controls playsInline style={{ width: '100%', borderRadius: 8, maxHeight: 300 }} />
              <div style={{ fontSize: 14, color: '#aaa', marginTop: 4 }}>时长: {cam.video.duration}秒</div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>🎤 语音旁白：</div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, fontSize: 15, color: '#ccc', lineHeight: 1.6, minHeight: 50 }}>
              {speech.transcript || '（无语音内容）'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { cam.reset(); speech.reset(); setMode(prevMode) }}
              style={bigBtn('#fff', '', '#f59e0b')}>🔄 重新采集</button>
            <button onClick={handleSave} disabled={saving}
              style={bigBtn('#fff', '', saving ? '#666' : '#22c55e')}>{saving ? `保存中... ${uploadProgress}` : '💾 保存到云端'}</button>
          </div>
          {saveMsg && <div style={{ marginTop: 12, fontSize: 15, color: saveMsg.startsWith('✅') ? '#4ade80' : '#f87171' }}>{saveMsg}</div>}
        </div>
      </div>
    )
  }

  // ===== 空闲模式 =====
  return (
    <div style={{ ...fullScreen, flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(180deg, #0f0c29, #302b63, #24243e)', gap: 24 }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>📷</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>照片录入</h1>
        <p style={{ fontSize: 16, color: '#aaa', marginTop: 8 }}>拍摄纸质照片，边翻阅边讲述故事</p>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        <button onClick={enterPhoto} style={bigBtn('#fff', '#6366f1', '#6366f1')}>📸 拍照录入<br /><span style={{ fontSize: 12, opacity: 0.7 }}>最多10张</span></button>
        <button onClick={enterVideo} style={bigBtn('#fff', '#8b5cf6', '#8b5cf6')}>🎥 录像录入<br /><span style={{ fontSize: 12, opacity: 0.7 }}>最长60秒</span></button>
      </div>
      <button onClick={onClose} style={{ ...bigBtn('rgba(255,255,255,0.6)', '', 'transparent'), border: '1px solid rgba(255,255,255,0.2)', fontSize: 15, padding: '10px 30px' }}>返回</button>
      {cam.camera.error && <div style={{ color: '#f87171', fontSize: 14, maxWidth: 300, textAlign: 'center' }}>{cam.camera.error}</div>}
    </div>
  )
}

// ===== 样式工具 =====
const fullScreen: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50000,
  display: 'flex',
}

const countBadge: React.CSSProperties = {
  position: 'absolute', top: 16, left: 16,
  background: 'rgba(0,0,0,0.6)', color: '#fff',
  borderRadius: 12, padding: '4px 14px', fontSize: 16, fontWeight: 600,
}

const bigBtn = (color: string, bgFallback: string, bg: string): React.CSSProperties => ({
  color, border: 'none', borderRadius: 14, fontSize: 18, fontWeight: 600,
  padding: '14px 28px', cursor: 'pointer', background: bg || bgFallback,
  textAlign: 'center' as const, lineHeight: 1.4,
  transition: 'opacity 0.15s', opacity: bg === '#444' ? 0.5 : 1,
})

const iconBtn = (color: string, bg: string): React.CSSProperties => ({
  position: 'absolute' as const, top: 16, right: 16,
  background: bg, color, border: 'none',
  borderRadius: 20, width: 36, height: 36, fontSize: 16,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
})
