/**
 * 语音旁白采集 Hook — Web Speech API
 * 浏览器内置 SpeechRecognition，中文实时转写
 */
import { useState, useRef, useCallback, useEffect } from 'react'

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

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null

export function useSpeechCapture() {
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 三档支持度: 'native' = Web Speech, 'server' = 服务端 ASR 兜底, 'none' = 不支持
  const [mode, setMode] = useState<'native' | 'server' | 'none'>(
    SpeechRecognitionAPI ? 'native' : 'server'
  )

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const listeningRef = useRef(false)

  // Android Chrome 部分机型 SpeechRecognition 存在但实际不可用（首次返回 'not-allowed' / 'no-speech'）
  // 失败时降级到服务端 ASR
  const fallbackToServer = useCallback(() => {
    setMode('server')
    setError('浏览器语音识别不可用，将使用服务端识别（需上传音频）')
  }, [])

  // 注意：不在 mount 时主动探测（会触发麦克风权限弹窗）
  // 改为：用户首次点开始录音时启动 native
  // 若 2.5s 内无 result，或 onerror 收到 not-allowed → fallbackToServer

  const startListening = useCallback(() => {
    if (mode === 'none' || !SpeechRecognitionAPI) return
    if (recognitionRef.current) recognitionRef.current.abort()

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
      interimRef.current = interimText
      setInterim(interimText)
    }

    recognition.onerror = (event: SpeechRecognitionError) => {
      // Android 关键: not-allowed / service-not-allowed 永久降级
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        fallbackToServer()
        listeningRef.current = false
        setListening(false)
        return
      }
      if (event.error === 'no-speech') {
        if (listeningRef.current) {
          setTimeout(() => { try { recognition.start() } catch {} }, 500)
        }
        return
      }
      if (event.error === 'aborted') return
      console.warn('[Speech]', event.error, event.message)
      setError(`语音识别错误: ${event.error}`)
      if (event.error === 'network' && listeningRef.current) {
        setTimeout(() => { try { recognition.start() } catch {} }, 1000)
      }
    }

    recognition.onend = () => {
      if (listeningRef.current && recognitionRef.current === recognition) {
        try { recognition.start() } catch {}
      }
    }

    recognitionRef.current = recognition
    finalRef.current = ''
    interimRef.current = ''
    setTranscript('')
    setInterim('')
    try {
      recognition.start()
      setListening(true)
      listeningRef.current = true
    } catch {
      setListening(false)
      listeningRef.current = false
    }
  }, [])

  const stopListening = useCallback(() => {
    listeningRef.current = false
    setListening(false)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    return finalRef.current + (interimRef.current || '')
  }, [])

  const reset = useCallback(() => {
    finalRef.current = ''
    interimRef.current = ''
    setTranscript('')
    setInterim('')
  }, [])

  useEffect(() => {
    return () => {
      listeningRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
      }
    }
  }, [])

  return {
    transcript,
    interim,
    listening,
    supported: mode !== 'none',
    mode,
    error,
    startListening,
    stopListening,
    reset,
  }
}
