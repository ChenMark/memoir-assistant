/**
 * 通知路由
 * GET    /notifications        获取列表（支持未读筛选）
 * POST   /notifications/:id/read   标记已读
 * POST   /notifications/read-all   全部已读
 * DELETE /notifications/:id   删除单条
 * DELETE /notifications       清空全部
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'
import rateLimit from 'express-rate-limit'

const router = Router()
router.use(authMiddleware)

// ✅ S2 修复：批量操作加速率限制
const bulkLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: '操作过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

const listQuerySchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
})

// GET /notifications
router.get('/', async (req, res) => {
  const uid = userId(req)
  const parse = listQuerySchema.safeParse(req.query)
  if (!parse.success) {
    return res.status(400).json({ error: '参数错误', details: parse.error.flatten() })
  }
  const { unread, limit, cursor } = parse.data
  const where: any = { userId: uid }
  if (unread === 'true') where.read = false

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { userId: uid } }),
    prisma.notification.count({ where: { userId: uid, read: false } }),
  ])

  const hasMore = items.length > limit
  const data = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? data[data.length - 1].id : null

  res.json({
    items: data.map(formatNotification),
    total,
    unreadCount,
    nextCursor,
  })
})

// POST /notifications/:id/read
router.post('/:id/read', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: uid },
    data: { read: true },
  })
  if (result.count === 0) {
    return res.status(404).json({ error: '通知不存在' })
  }
  res.json({ success: true })
})

// POST /notifications/read-all
router.post('/read-all', bulkLimiter, async (req, res) => {
  const uid = userId(req)
  const result = await prisma.notification.updateMany({
    where: { userId: uid, read: false },
    data: { read: true },
  })
  res.json({ success: true, updated: result.count })
})

// DELETE /notifications/:id
router.delete('/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.notification.deleteMany({
    where: { id: req.params.id, userId: uid },
  })
  if (result.count === 0) {
    return res.status(404).json({ error: '通知不存在' })
  }
  res.json({ success: true })
})

// DELETE /notifications
router.delete('/', bulkLimiter, async (req, res) => {
  const uid = userId(req)
  const result = await prisma.notification.deleteMany({ where: { userId: uid } })
  res.json({ success: true, deleted: result.count })
})

function formatNotification(n: any) {
  let meta: any = {}
  try {
    meta = JSON.parse(n.meta || '{}')
  } catch {}
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    meta,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }
}

/**
 * 触发通知（其他路由调用）
 * sendNotification(userId, type, title, body, link?, meta?)
 */
export async function sendNotification(
  userId: string,
  type: 'comment' | 'share' | 'agent' | 'system' | 'reminder',
  title: string,
  body: string,
  link?: string,
  meta?: Record<string, unknown>,
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      link: link || null,
      meta: JSON.stringify(meta || {}),
    },
  })
}

export default router
