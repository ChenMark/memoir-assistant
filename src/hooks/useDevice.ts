/**
 * Android 平板设备检测 + 能力检测
 * - 通过屏幕宽度 + 触摸能力判定设备类型
 * - 检测 Web API 可用性，提供降级方案
 */
import { useEffect, useState } from 'react'

export type DeviceType = 'mobile' | 'tablet-small' | 'tablet' | 'desktop'

export interface DeviceInfo {
  type: DeviceType
  width: number
  height: number
  isAndroid: boolean
  isHarmonyOS: boolean
  hasTouch: boolean
  isLandscape: boolean
  pixelRatio: number
}

export interface CapabilityInfo {
  speechRecognition: boolean
  mediaRecorder: boolean
  webRTC: boolean
  serviceWorker: boolean
  visualViewport: boolean
  vibration: boolean
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

const isAndroid = /Android/i.test(ua)
const isHarmonyOS = /HarmonyOS/i.test(ua) || /OpenHarmony/i.test(ua)

function detectType(w: number, h: number, hasTouch: boolean): DeviceType {
  if (w < 600) return 'mobile'
  if (w >= 600 && w < 840) return 'tablet-small'
  if (w >= 840 && w < 1200) return 'tablet'
  // 有触摸 + 大屏 → 触屏桌面（少见，但 Surface 等支持）
  if (w >= 1200 && hasTouch) return 'desktop'
  return 'desktop'
}

function detectCapabilities(): CapabilityInfo {
  if (typeof window === 'undefined') {
    return {
      speechRecognition: false,
      mediaRecorder: false,
      webRTC: false,
      serviceWorker: false,
      visualViewport: false,
      vibration: false,
    }
  }
  return {
    speechRecognition: !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition,
    mediaRecorder: !!window.MediaRecorder,
    webRTC: !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia,
    serviceWorker: 'serviceWorker' in navigator,
    visualViewport: !!window.visualViewport,
    vibration: 'vibrate' in navigator,
  }
}

export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        type: 'desktop',
        width: 0,
        height: 0,
        isAndroid: false,
        isHarmonyOS: false,
        hasTouch: false,
        isLandscape: false,
        pixelRatio: 1,
      }
    }
    const w = window.innerWidth
    const h = window.innerHeight
    return {
      type: detectType(w, h, 'ontouchstart' in window),
      width: w,
      height: h,
      isAndroid,
      isHarmonyOS,
      hasTouch: 'ontouchstart' in window,
      isLandscape: w > h,
      pixelRatio: window.devicePixelRatio || 1,
    }
  })

  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setInfo({
        type: detectType(w, h, 'ontouchstart' in window),
        width: w,
        height: h,
        isAndroid,
        isHarmonyOS,
        hasTouch: 'ontouchstart' in window,
        isLandscape: w > h,
        pixelRatio: window.devicePixelRatio || 1,
      })
    }
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])

  return info
}

export function useCapabilities(): CapabilityInfo {
  const [caps, setCaps] = useState<CapabilityInfo>(() => detectCapabilities())
  // 能力在 mount 后基本稳定，无需监听
  return caps
}

/**
 * Android 摄像头采集（带降级）
 * 1080p → 720p → 仅视频
 */
export async function getAndroidCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前设备不支持摄像头')
  }

  // 优先：1080p 后置
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: true,
    })
  } catch (e1) {
    console.warn('[camera] 1080p 失败，尝试 720p:', e1)
  }

  // 降级 1：720p
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: true,
    })
  } catch (e2) {
    console.warn('[camera] 720p 失败，尝试仅视频:', e2)
  }

  // 降级 2：仅视频
  return await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  })
}
