/**
 * Android 视觉视口适配
 * - 监听 visualViewport，解决 Android 软键盘遮挡
 * - 暴露 CSS 变量 --viewport-height
 * - 使用 requestAnimationFrame 节流，避免连续 resize 时频繁重排
 */
import { useEffect } from 'react'

export function useVisualViewport() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    let rafId = 0

    const setVar = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--viewport-height', `${vv.height}px`)
        document.documentElement.style.setProperty('--viewport-offset-top', `${vv.offsetTop}px`)
      })
    }

    setVar()
    vv.addEventListener('resize', setVar)
    vv.addEventListener('scroll', setVar)
    return () => {
      cancelAnimationFrame(rafId)
      vv.removeEventListener('resize', setVar)
      vv.removeEventListener('scroll', setVar)
    }
  }, [])
}
