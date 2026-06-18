/**
 * 公开分享（无需登录访问）
 * GET /public/memoir/:token       公开回忆录
 * GET /public/photo/:token        公开照片
 * GET /public/profile/:userId     公开个人页（仅展示公开分组内容）
 * GET /public/health              健康检查
 */
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { generateDownloadUrl } from '../lib/oss.js'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', type: 'public' })
})

router.get('/memoir/:token', async (req, res) => {
  const share = await prisma.shareLink.findFirst({
    where: { token: req.params.token, expiresAt: { gt: new Date() } },
    include: { memoir: true },
  })
  if (!share) return res.status(404).json({ error: '链接已失效' })
  if (!share.memoir) return res.status(404).json({ error: '内容不存在' })

  await prisma.shareLink
    .update({ where: { id: share.id }, data: { visits: { increment: 1 } } })
    .catch(() => {})

  const m = share.memoir
  res.json({
    title: m.title,
    content: m.content,
    date: m.date,
    tags: safeParse(m.tags),
    mood: m.mood,
    visits: share.visits,
    author: { username: '忆往昔用户' },
  })
})

router.get('/photo/:token', async (req, res) => {
  // 复用 photo share 端点（gallery-interact 已有 sharedPhotoHandler）
  return res.status(501).json({ error: 'use /api/v1/shared/photo/:token' })
})

function safeParse(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export default router
