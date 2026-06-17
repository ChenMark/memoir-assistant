/**
 * 语音旁白采集 Hook — Web Speech API
 * 浏览器内置 SpeechRecognition，中文实时转写
 */
import { useState, useRef, useCallback, useEffect } from 'react'

// 扩展 TS 类型
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionError extends Event {
  error: string
  message: string
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionError) => void) | null
  onend: (() => void) | null
}

const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export function useSpeechCapture() {
  const [transcript, setTranscript] = useState('') // 完整转写结果
  const [interim, setInterim] = useState('')       // 实时中间态
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(!!SpeechRecognitionAPI)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const finalRef = useRef('')

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setSupported(false)
      return
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    const recognition: ISpeechRecognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalRef.current += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      setTranscript(finalRef.current)
      setInterim(interimText)
    }

    recognition.onerror = (event: SpeechRecognitionError) => {
      if (event.error === 'no-speech') return // 正常静音，忽略
      if (event.error === 'aborted') return
      console.warn('[Speech]', event.error, event.message)
      // 自动重连
      if (event.error === 'network') {
        setTimeout(() => {
          try { recognition.start() } catch {}
        }, 1000)
      }
    }

    recognition.onend = () => {
      // 自动续接（Chrome 默认 60 秒超时）
      if (listening && recognitionRef.current === recognition) {
        try { recognition.start() } catch {}
      }
    }

    recognitionRef.current = recognition
    finalRef.current = ''
    setTranscript('')
    setInterim('')
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [listening])

  const stopListening = useCallback(() => {
    setListening(false)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    // 返回完整文本
    return finalRef.current + (interim || '')
  }, [interim])

  const reset = useCallback(() => {
    finalRef.current = ''
    setTranscript('')
    setInterim('')
  }, [])

  // 清理
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
      }
    }
  }, [])

  return {
    transcript,
    interim,
    listening,
    supported,
    startListening,
    stopListening,
    reset,
  }
}
