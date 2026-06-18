/**
 * 服务端 ASR 转写
 * POST /capture/asr   上传音频 blob → 返回转写文本
 *
 * 策略：
 *  1. 若配置 OPENAI_API_KEY → 使用 OpenAI Whisper API
 *  2. 否则降级为占位响应（客户端继续用浏览器 ASR）
 *
 * 客户端 useSpeechCapture 已在 mode='server' 时调用此端点
 */
import { Router } from 'express'
import { authMiddleware, userId } from '../middleware/auth.js'
import multer from 'multer'

const router = Router()
router.use(authMiddleware)

// 内存存储音频（最大 25MB - Whisper 限制）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
}) as any

router.post('/', upload.single('audio'), async (req, res) => {
  const file = req.file
  if (!file) {
    return res.status(400).json({ error: '缺少音频文件 (field: audio)' })
  }

  const lang = (req.body.lang as string) || 'zh'

  // 方案 1: OpenAI Whisper
  if (process.env.OPENAI_API_KEY) {
    try {
      const form = new FormData()
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype })
      form.append('file', blob, file.originalname || 'audio.webm')
      form.append('model', 'whisper-1')
      form.append('language', lang)
      form.append('response_format', 'json')

      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      })

      if (!r.ok) {
        const errText = await r.text()
        console.error('[ASR] OpenAI Whisper failed:', r.status, errText)
        return res.status(502).json({ error: '转写服务暂不可用', mode: 'unavailable' })
      }

      const data: any = await r.json()
      return res.json({
        mode: 'openai-whisper',
        text: data.text || '',
        language: lang,
        duration: data.duration,
      })
    } catch (err) {
      console.error('[ASR] Whisper error:', err)
      return res.status(500).json({ error: '转写失败', detail: (err as Error).message })
    }
  }

  // 方案 2: 降级 — 无 OPENAI_API_KEY
  // 真实部署可接入阿里云/腾讯云 ASR
  res.status(503).json({
    error: '服务端 ASR 未配置',
    mode: 'unavailable',
    hint: '设置 OPENAI_API_KEY 环境变量启用 Whisper，或使用浏览器 Web Speech',
  })
})

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    enabled: !!process.env.OPENAI_API_KEY,
    provider: process.env.OPENAI_API_KEY ? 'openai-whisper' : 'none',
  })
})

export default router
