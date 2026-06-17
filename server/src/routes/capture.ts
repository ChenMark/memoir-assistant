/**
 * 采集会话路由 — 摄像头拍照/录像
 */
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from './auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

// 采集会话限流：每分钟 10 次
const captureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: '操作过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.use(authMiddleware)
router.use(captureLimiter)

function userId(req: Request): string {
  return (req as any).userId as string
}

// ============ Zod 校验 ============
const createSessionSchema = z.object({
  type: z.enum(['photo', 'video'], { message: 'type 必须是 photo 或 video' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date 格式: YYYY-MM-DD'),
  tags: z.array(z.string().max(20)).max(10).default([]),
})

const updateSessionSchema = z.object({
  ossKeys: z.array(z.string()).optional(),
  transcript: z.string().max(5000).optional(),
  duration: z.number().min(0).max(60).optional(),
  itemCount: z.number().min(0).max(10).optional(),
  tags: z.array(z.string().max(20)).max(10).optional(),
})

// ============ 路由 ============

/** POST /capture/session — 创建空会话 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const parsed = createSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || '输入验证失败'
      return res.status(400).json({ error: msg })
    }
    const { type, tags, date } = parsed.data

    const session = await prisma.captureSession.create({
      data: {
        userId: uid,
        type,
        itemCount: 0,
        date,
        tags: JSON.stringify(tags),
        ossKeys: '[]',
      },
    })
    res.status(201).json({ session: formatSession(session) })
  } catch (err: unknown) {
    console.error('[capture/session]', (err as Error).message)
    res.status(500).json({ error: '创建会话失败' })
  }
})

/** PUT /capture/session/:id — 上传完成后更新 */
router.put('/session/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const parsed = updateSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || '输入验证失败'
      return res.status(400).json({ error: msg })
    }

    const existing = await prisma.captureSession.findFirst({
      where: { id: req.params.id, userId: uid },
    })
    if (!existing) return res.status(404).json({ error: '会话不存在' })

    const { ossKeys, transcript, duration, itemCount, tags } = parsed.data
    const updateData: Record<string, unknown> = {}
    if (ossKeys !== undefined) updateData.ossKeys = JSON.stringify(ossKeys)
    if (transcript !== undefined) updateData.transcript = transcript
    if (duration !== undefined) updateData.duration = duration
    if (itemCount !== undefined) updateData.itemCount = itemCount
    if (tags !== undefined) updateData.tags = JSON.stringify(tags)

    const session = await prisma.captureSession.update({
      where: { id: req.params.id },
      data: updateData,
    })
    res.json({ session: formatSession(session) })
  } catch (err: unknown) {
    console.error('[capture/update]', (err as Error).message)
    res.status(500).json({ error: '更新会话失败' })
  }
})

/** GET /capture/sessions — 获取历史列表 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { type, limit = '20', offset = '0' } = req.query as Record<string, string>
    const where: Record<string, unknown> = { userId: uid }
    if (type && ['photo', 'video'].includes(type)) where.type = type

    const [sessions, total] = await Promise.all([
      prisma.captureSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(100, Number(limit)),
        skip: Math.max(0, Number(offset)),
      }),
      prisma.captureSession.count({ where }),
    ])
    res.json({ sessions: sessions.map(formatSession), total })
  } catch (err: unknown) {
    console.error('[capture/sessions]', (err as Error).message)
    res.status(500).json({ error: '获取列表失败' })
  }
})

/** DELETE /capture/session/:id */
router.delete('/session/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const existing = await prisma.captureSession.findFirst({
      where: { id: req.params.id, userId: uid },
    })
    if (!existing) return res.status(404).json({ error: '会话不存在' })
    await prisma.captureSession.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err: unknown) {
    console.error('[capture/delete]', (err as Error).message)
    res.status(500).json({ error: '删除会话失败' })
  }
})

function formatSession(s: Record<string, unknown>) {
  return {
    ...s,
    ossKeys: JSON.parse((s.ossKeys as string) || '[]'),
    tags: JSON.parse((s.tags as string) || '[]'),
  }
}

export default router
