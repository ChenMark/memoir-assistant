/**
 * 仪表盘聚合 API
 * GET /dashboard/stats     4 个核心数据统计（memoirs/photos/friends/hobbies）
 * GET /dashboard/activity  最近 N 条活动
 * GET /dashboard/timeline  "3 年前的今天您拍了 X 张照片" 回忆时间线
 */
import { Router } from 'express'
import { authMiddleware, userId } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
router.use(authMiddleware)

router.get('/stats', async (req, res) => {
  const uid = userId(req)
  const [memoirs, photos, friends, hobbies, captures, lastMemoir] = await Promise.all([
    prisma.memoir.count({ where: { userId: uid } }),
    prisma.gallery.count({ where: { userId: uid } }),
    prisma.friend.count({ where: { userId: uid } }),
    prisma.hobby.count({ where: { userId: uid } }),
    prisma.captureSession.count({ where: { userId: uid } }),
    prisma.memoir.findFirst({
      where: { userId: uid },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true, title: true },
    }),
  ])
  res.json({
    memoirs,
    photos,
    friends,
    hobbies,
    captures,
    lastMemoirAt: lastMemoir?.updatedAt?.toISOString() || null,
    lastMemoirTitle: lastMemoir?.title || null,
  })
})

router.get('/activity', async (req, res) => {
  const uid = userId(req)
  const limit = Math.min(20, Number(req.query.limit) || 10)
  const [memoirs, photos, hobbies, captures] = await Promise.all([
    prisma.memoir.findMany({
      where: { userId: uid },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.gallery.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, caption: true, createdAt: true, ossKey: true },
    }),
    prisma.hobby.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true, category: true, createdAt: true },
    }),
    prisma.captureSession.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, type: true, date: true, createdAt: true },
    }),
  ])

  const events: any[] = []
  memoirs.forEach((m) =>
    events.push({
      type: 'memoir',
      id: m.id,
      title: m.title,
      timestamp: m.updatedAt.toISOString(),
    }),
  )
  photos.forEach((p) =>
    events.push({
      type: 'photo',
      id: p.id,
      title: p.caption,
      timestamp: p.createdAt.toISOString(),
    }),
  )
  hobbies.forEach((h) =>
    events.push({
      type: 'hobby',
      id: h.id,
      title: h.title,
      subtitle: h.category,
      timestamp: h.createdAt.toISOString(),
    }),
  )
  captures.forEach((c) =>
    events.push({
      type: 'capture',
      id: c.id,
      title: c.type === 'video' ? '录像' : '拍照',
      subtitle: c.date,
      timestamp: c.createdAt.toISOString(),
    }),
  )

  events.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
  res.json({ items: events.slice(0, limit) })
})

router.get('/timeline', async (req, res) => {
  const uid = userId(req)
  // 找过去 1-10 年同月同日有记录
  const today = new Date()
  const items: any[] = []

  for (let year = 1; year <= 5; year++) {
    const target = new Date(today.getFullYear() - year, today.getMonth(), today.getDate())
    const start = new Date(target)
    start.setDate(start.getDate() - 3)
    const end = new Date(target)
    end.setDate(end.getDate() + 3)
    const dateStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)

    const [memoirs, photos] = await Promise.all([
      prisma.memoir.findMany({
        where: { userId: uid, date: { gte: dateStr, lte: endStr } },
        select: { id: true, title: true, date: true },
      }),
      prisma.gallery.findMany({
        where: { userId: uid, date: { gte: dateStr, lte: endStr } },
        select: { id: true, caption: true, date: true, ossKey: true },
      }),
    ])
    if (memoirs.length + photos.length > 0) {
      items.push({
        yearAgo: year,
        targetDate: dateStr,
        memoirs,
        photos: photos.slice(0, 5),
        totalCount: memoirs.length + photos.length,
      })
    }
  }
  res.json({ items })
})

export default router
