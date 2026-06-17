/**
 * 摄像头 Hook — getUserMedia 封装，拍照 + 录像
 * 优先调用后置镜头，分辨率 ≥ 1080p
 */
import { useState, useRef, useCallback, useEffect } from 'react'

export interface CameraState {
  stream: MediaStream | null
  error: string | null
  ready: boolean
  facing: 'environment' | 'user'
}

export interface PhotoCapture {
  id: string
  blob: Blob
  url: string
  width: number
  height: number
  size: number
}

export interface VideoCapture {
  blob: Blob | null
  url: string | null
  duration: number
  recording: boolean
}

const VIDEO_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' } as ConstrainDOMString,
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: 30, min: 24 },
  },
  audio: true,
}

const MAX_PHOTOS = 10
const MAX_VIDEO_SEC = 60

export function useCamera() {
  const [camera, setCamera] = useState<CameraState>({
    stream: null, error: null, ready: false, facing: 'environment',
  })
  const [photos, setPhotos] = useState<PhotoCapture[]>([])
  const [video, setVideo] = useState<VideoCapture>({
    blob: null, url: null, duration: 0, recording: false,
  })
  const [videoTimer, setVideoTimer] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null!)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number>(0)
  const videoStartRef = useRef<number>(0)
  const videoTimerRef = useRef(0)
  const blobUrlsRef = useRef<string[]>([])  // 追踪创建的 blob URL 以便清理

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      setCamera((prev) => ({ ...prev, error: null }))
      const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS)
      streamRef.current = stream
      setCamera({ stream, error: null, ready: true, facing: 'environment' })
      if (videoRef.current) videoRef.current.srcObject = stream
      return stream
    } catch (err: unknown) {
      const msg = (err as DOMException).name === 'NotAllowedError'
        ? '摄像头权限被拒绝，请在浏览器设置中允许'
        : (err as DOMException).name === 'NotFoundError'
        ? '未检测到摄像头设备'
        : `摄像头启动失败: ${(err as Error).message}`
      setCamera({ stream: null, error: msg, ready: false, facing: 'environment' })
      return null
    }
  }, [])

  // 停止摄像头（内部使用 ref 避免闭包问题）
  const stopCamera = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // 释放所有 blob URL
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrlsRef.current = []
    setCamera({ stream: null, error: null, ready: false, facing: 'environment' })
  }, [])

  // 拍照
  const takePhoto = useCallback(() => {
    const v = videoRef.current
    if (!v || !streamRef.current) return null
    if (photos.length >= MAX_PHOTOS) return null

    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    if (camera.facing === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        const photo = makePhoto(blob, canvas.width, canvas.height)
        blobUrlsRef.current.push(photo.url)
        setPhotos((prev) => [...prev, photo])
      }
    }, 'image/jpeg', 0.92)
    return null
  }, [camera.facing, photos.length])

  // 删除照片
  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id)
      if (photo) URL.revokeObjectURL(photo.url)
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  // 开始录像
  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    const mimeType = getBestMimeType()
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
    })
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const url = URL.createObjectURL(blob)
      blobUrlsRef.current.push(url)
      setVideo({ blob, url, duration: videoTimerRef.current, recording: false })
      clearInterval(timerRef.current)
    }
    recorder.start(1000)
    mediaRecorderRef.current = recorder
    videoStartRef.current = Date.now()

    setVideo({ blob: null, url: null, duration: 0, recording: true })
    setVideoTimer(0)

    timerRef.current = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - videoStartRef.current) / 1000)
      videoTimerRef.current = elapsed
      setVideoTimer(elapsed)
      if (elapsed >= MAX_VIDEO_SEC) recordingGracefulStop(recorder)
    }, 200)
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // 翻转镜头
  const flipCamera = useCallback(async () => {
    stopCamera()
    const newFacing: ConstrainDOMString = camera.facing === 'environment'
      ? 'user' as ConstrainDOMString
      : { ideal: 'environment' } as ConstrainDOMString
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...VIDEO_CONSTRAINTS.video, facingMode: newFacing },
        audio: true,
      })
      streamRef.current = stream
      setCamera({
        stream, error: null, ready: true,
        facing: camera.facing === 'environment' ? 'user' : 'environment',
      })
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      setCamera((prev) => ({ ...prev, error: `翻转镜头失败: ${(err as Error).message}` }))
    }
  }, [camera.facing, stopCamera])

  const reset = useCallback(() => {
    stopRecording()
    setPhotos((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.url)); return [] })
    if (video.url) URL.revokeObjectURL(video.url)
    setVideo({ blob: null, url: null, duration: 0, recording: false })
    setVideoTimer(0)
    chunksRef.current = []
  }, [stopRecording, video.url])

  // ===== 组件卸载清理 =====
  useEffect(() => {
    return () => {
      // 停止媒体流
      const stream = streamRef.current
      if (stream) stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      // 清理计时器
      clearInterval(timerRef.current)
      // 释放所有 blob URL
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrlsRef.current = []
    }
  }, [])

  return {
    camera, photos, video, videoTimer, videoRef,
    startCamera, stopCamera, takePhoto, removePhoto,
    startRecording, stopRecording, flipCamera, reset,
    maxPhotos: MAX_PHOTOS, maxVideoSec: MAX_VIDEO_SEC,
  }
}

function makePhoto(blob: Blob, w: number, h: number): PhotoCapture {
  return {
    id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    blob,
    url: URL.createObjectURL(blob),
    width: w,
    height: h,
    size: blob.size,
  }
}

function getBestMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ]
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return 'video/webm'
}

/** 优雅停止录制（内部调用，避免 useCallback dep 循环） */
function recordingGracefulStop(recorder: MediaRecorder) {
  if (recorder.state === 'recording') recorder.stop()
}
