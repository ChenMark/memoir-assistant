/**
 * Android 视觉视口适配
 * - 监听 visualViewport，解决 Android 软键盘遮挡
 * - 暴露 CSS 变量 --viewport-height
 */
import { useEffect } from 'react'

export function useVisualViewport() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    const setVar = () => {
      document.documentElement.style.setProperty('--viewport-height', `${vv.height}px`)
      document.documentElement.style.setProperty('--viewport-width', `${vv.width}px`)
      document.documentElement.style.setProperty('--viewport-offset-top', `${vv.offsetTop}px`)
    }

    setVar()
    vv.addEventListener('resize', setVar)
    vv.addEventListener('scroll', setVar)
    return () => {
      vv.removeEventListener('resize', setVar)
      vv.removeEventListener('scroll', setVar)
    }
  }, [])
}
