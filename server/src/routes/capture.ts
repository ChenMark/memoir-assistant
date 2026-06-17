/**
 * 采集会话路由 — 摄像头拍照/录像
 */
import { Router, Request, Response } from 'express'
import { authMiddleware } from './auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
router.use(authMiddleware)

function userId(req: Request): string {
  return (req as any).userId as string
}

/** POST /capture/session — 创建空会话 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { type, tags, date } = req.body
    if (!type || !['photo', 'video'].includes(type)) {
      return res.status(400).json({ error: 'type 必须是 photo 或 video' })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date 格式: YYYY-MM-DD' })
    }

    const session = await prisma.captureSession.create({
      data: {
        userId: uid,
        type,
        itemCount: 0,
        date,
        tags: JSON.stringify(tags || []),
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
    const existing = await prisma.captureSession.findFirst({
      where: { id: req.params.id, userId: uid },
    })
    if (!existing) return res.status(404).json({ error: '会话不存在' })

    const { ossKeys, transcript, duration, itemCount, tags } = req.body
    const updateData: any = {}
    if (ossKeys !== undefined) updateData.ossKeys = JSON.stringify(ossKeys)
    if (transcript !== undefined) updateData.transcript = transcript.substring(0, 5000)
    if (duration !== undefined) updateData.duration = Math.min(60, Number(duration))
    if (itemCount !== undefined) updateData.itemCount = Number(itemCount)
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
    const where: any = { userId: uid }
    if (type && ['photo', 'video'].includes(type)) where.type = type

    const sessions = await prisma.captureSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Number(limit)),
      skip: Math.max(0, Number(offset)),
    })
    res.json({ sessions: sessions.map(formatSession), total: sessions.length })
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

function formatSession(s: any) {
  return {
    ...s,
    ossKeys: JSON.parse(s.ossKeys || '[]'),
    tags: JSON.parse(s.tags || '[]'),
  }
}

export default router
