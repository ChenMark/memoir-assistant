/**
 * 回忆录评论 + 分享
 * GET    /memoir/:id/comments   评论列表
 * POST   /memoir/:id/comments   添加评论
 * DELETE /memoir/:id/comments/:cid  删除评论
 * POST   /memoir/:id/share      生成分享链接
 * GET    /shared/memoir/:token  公开分享页
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, optionalAuth, userId } from '../middleware/auth.js'
import { sendNotification } from './notification.js'
import crypto from 'node:crypto'

const router = Router()

// 评论子路由（需要登录）
const commentRouter = Router({ mergeParams: true })
commentRouter.use(authMiddleware)

const commentSchema = z.object({
  content: z.string().min(1).max(500),
})

commentRouter.get('/', async (req, res) => {
  const memoirId = (req.params as any).id
  const items = await prisma.memoirComment.findMany({
    where: { memoirId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { username: true, avatar: true } },
    },
  })
  res.json({
    items: items.map((c) => ({
      id: c.id,
      content: c.content,
      author: c.user.username,
      avatar: c.user.avatar,
      createdAt: c.createdAt.toISOString(),
    })),
  })
})

commentRouter.post('/', async (req, res) => {
  const uid = userId(req)
  const memoirId = (req.params as any).id
  const parse = commentSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ error: '参数错误', details: parse.error.flatten() })
  }
  const memoir = await prisma.memoir.findUnique({ where: { id: memoirId } })
  if (!memoir) return res.status(404).json({ error: '回忆录不存在' })

  const comment = await prisma.memoirComment.create({
    data: {
      memoirId,
      userId: uid,
      content: parse.data.content,
    },
  })

  // 通知作者（评论自己作品不发）
  if (memoir.userId !== uid) {
    await sendNotification(
      memoir.userId,
      'comment',
      '您的回忆录收到新评论',
      parse.data.content.slice(0, 50),
      `/memoir/${memoirId}`,
      { memoirId, commentId: comment.id },
    ).catch(() => {})
  }
  res.json({ id: comment.id, success: true })
})

commentRouter.delete('/:cid', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.memoirComment.deleteMany({
    where: { id: (req.params as any).cid, memoirId: (req.params as any).id, userId: uid },
  })
  if (result.count === 0) return res.status(404).json({ error: '评论不存在' })
  res.json({ success: true })
})

// 分享子路由
const shareRouter = Router({ mergeParams: true })
shareRouter.use(authMiddleware)

shareRouter.post('/', async (req, res) => {
  const uid = userId(req)
  const memoirId = (req.params as any).id
  const memoir = await prisma.memoir.findFirst({ where: { id: memoirId, userId: uid } })
  if (!memoir) return res.status(404).json({ error: '回忆录不存在' })

  // 检查是否已有分享
  let share = await prisma.shareLink.findFirst({
    where: { memoirId, userId: uid, expiresAt: { gt: new Date() } },
  })
  if (!share) {
    share = await prisma.shareLink.create({
      data: {
        userId: uid,
        memoirId,
        token: crypto.randomBytes(16).toString('hex'),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }
  res.json({
    shareToken: share.token,
    shareUrl: `${req.protocol}://${req.get('host')}/shared/memoir/${share.token}`,
    expiresAt: share.expiresAt.toISOString(),
  })
})

shareRouter.get('/', async (req, res) => {
  const uid = userId(req)
  const shares = await prisma.shareLink.findMany({
    where: { userId: uid, memoirId: (req.params as any).id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  res.json({
    items: shares.map((s) => ({
      token: s.token,
      shareUrl: `${req.protocol}://${req.get('host')}/shared/memoir/${s.token}`,
      expiresAt: s.expiresAt.toISOString(),
      visits: s.visits,
    })),
  })
})

// 公开访问（无需登录）
const publicRouter = Router()
publicRouter.get('/memoir/:token', optionalAuth, async (req, res) => {
  const share = await prisma.shareLink.findFirst({
    where: { token: req.params.token, expiresAt: { gt: new Date() } },
    include: { memoir: true },
  })
  if (!share) return res.status(404).json({ error: '链接已失效' })

  // 增加访问次数
  await prisma.shareLink
    .update({ where: { id: share.id }, data: { visits: { increment: 1 } } })
    .catch(() => {})

  const m = share.memoir
  if (!m) return res.status(404).json({ error: '内容不存在' })
  res.json({
    title: m.title,
    content: m.content,
    date: m.date,
    tags: JSON.parse(m.tags || '[]'),
    mood: m.mood,
    visits: share.visits,
    // 隐藏作者敏感信息
    author: { username: '忆往昔用户' },
  })
})

export { commentRouter, shareRouter, publicRouter }
export default { commentRouter, shareRouter, publicRouter }
