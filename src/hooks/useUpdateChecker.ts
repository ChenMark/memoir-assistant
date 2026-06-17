/**
 * OTA 在线更新检查器 Hook
 * 定期轮询版本 API，检测新版本并提示用户刷新
 */
import { useState, useEffect, useCallback } from 'react'

interface VersionInfo {
  version: string
  buildTime: string
  env: string
  features: string[]
  minClientVersion: string
  forceUpdate: boolean
}

const CURRENT_VERSION = '1.2.0'
const POLL_INTERVAL = 5 * 60 * 1000 // 5分钟轮询一次

export function useUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [forceUpdate, setForceUpdate] = useState(false)

  const checkForUpdate = useCallback(async () => {
    try {
      const res = await fetch('/api/version')
      if (!res.ok) return
      const info: VersionInfo = await res.json()

      // 版本号语义比较
      if (compareVersions(info.version, CURRENT_VERSION) > 0) {
        setUpdateAvailable(true)
        setRemoteVersion(info.version)
        setForceUpdate(info.forceUpdate)
      }
    } catch {
      // 静默失败，网络不可用时跳过
    }
  }, [])

  useEffect(() => {
    checkForUpdate()
    const timer = setInterval(checkForUpdate, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [checkForUpdate])

  const dismiss = useCallback(() => {
    setUpdateAvailable(false)
  }, [])

  const applyUpdate = useCallback(() => {
    window.location.reload()
  }, [])

  return { updateAvailable, remoteVersion, forceUpdate, dismiss, applyUpdate }
}

/** 简单语义版本比较: 返回 >0 表示 a > b */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}
