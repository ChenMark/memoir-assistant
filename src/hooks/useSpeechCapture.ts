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

const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export function useSpeechCapture() {
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [supported] = useState(!!SpeechRecognitionAPI)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const finalRef = useRef('')
  const interimRef = useRef('')       // ref 避免闭包读取过时 interim 值
  const listeningRef = useRef(false)   // ref 避免 onend 闭包读取过时 listening 值

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return
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
      if (event.error === 'no-speech') {
        // 无语音后尝试自动恢复
        if (listeningRef.current) {
          setTimeout(() => { try { recognition.start() } catch {} }, 500)
        }
        return
      }
      if (event.error === 'aborted') return
      console.warn('[Speech]', event.error, event.message)
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

  return { transcript, interim, listening, supported, startListening, stopListening, reset }
}
