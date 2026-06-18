/**
 * 全局搜索路由
 * GET /search?q=&types=&limit=
 *   跨 5 类资源全文搜索：memoir | photo | hobby | friend | capture
 *   使用现有 semanticSearch 引擎（标签感知 + 滑窗分词）
 */
import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware, userId } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { semanticSearch } from '../lib/semantic-search.js'
import { generateDownloadUrl } from '../lib/oss.js'

const router = Router()
router.use(authMiddleware)

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  types: z.string().optional(), // 逗号分隔 'memoir,photo'
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

router.get('/', async (req, res) => {
  const uid = userId(req)
  const parse = searchQuerySchema.safeParse(req.query)
  if (!parse.success) {
    return res.status(400).json({ error: '参数错误', details: parse.error.flatten() })
  }
  const { q, types, limit } = parse.data

  // 1. 跨资源语义搜索
  const semanticResults = await semanticSearch(uid, q)

  // 2. 类型过滤
  const allowTypes = types
    ? types.split(',').map((t) => t.trim()).filter(Boolean)
    : null
  let filtered = semanticResults
  if (allowTypes) {
    filtered = filtered.filter((r) => allowTypes.includes(r.type))
  }

  // 3. 截断
  const items = filtered.slice(0, limit)

  // 4. 补充精确信息（标题/日期/链接）
  const enriched = await Promise.all(
    items.map(async (item) => {
      const enriched: any = { ...item }
      if (item.type === 'memoir' && item.id) {
        const m = await prisma.memoir.findUnique({
          where: { id: item.id },
          select: { id: true, title: true, date: true, tags: true },
        })
        if (m) {
          enriched.title = m.title
          enriched.date = m.date
          enriched.tags = safeParse(m.tags)
          enriched.link = `/memoir/${m.id}`
        }
      } else if (item.type === 'photo' && item.id) {
        const p = await prisma.gallery.findUnique({
          where: { id: item.id },
          select: { id: true, caption: true, date: true, ossKey: true },
        })
        if (p) {
          enriched.title = p.caption
          enriched.date = p.date
          enriched.imageUrl = await generateDownloadUrl(p.ossKey)
          enriched.link = `/gallery?photo=${p.id}`
        }
      } else if (item.type === 'hobby' && item.id) {
        const h = await prisma.hobby.findUnique({
          where: { id: item.id },
          select: { id: true, title: true, category: true, rating: true },
        })
        if (h) enriched.title = h.title
      } else if (item.type === 'friend' && item.id) {
        const f = await prisma.friend.findUnique({
          where: { id: item.id },
          select: { name: true, relationship: true },
        })
        if (f) enriched.title = f.name
      } else if (item.type as string === 'capture' && item.id) {
        const c = await prisma.captureSession.findUnique({
          where: { id: item.id },
          select: { type: true, date: true, transcript: true },
        })
        if (c) {
          enriched.title = `${c.type === 'video' ? '录像' : '拍照'} ${c.date}`
          enriched.snippet = (c.transcript || '').slice(0, 80)
        }
      }
      return enriched
    }),
  )

  // 5. 同时返回数量统计
  const counts: Record<string, number> = {
    memoir: 0,
    photo: 0,
    hobby: 0,
    friend: 0,
    capture: 0,
  }
  semanticResults.forEach((r) => {
    counts[r.type] = (counts[r.type] || 0) + 1
  })

  res.json({
    query: q,
    total: semanticResults.length,
    counts,
    items: enriched,
  })
})

// 搜索建议（自动补全）
router.get('/suggest', async (req, res) => {
  const uid = userId(req)
  const q = String(req.query.q || '').trim()
  if (q.length < 1) {
    return res.json({ suggestions: [] })
  }
  const [memoirs, hobbies, friends] = await Promise.all([
    prisma.memoir.findMany({
      where: { userId: uid, OR: [
        { title: { contains: q } },
        { content: { contains: q } },
      ] },
      select: { title: true },
      take: 5,
    }),
    prisma.hobby.findMany({
      where: { userId: uid, title: { contains: q } },
      select: { title: true },
      take: 3,
    }),
    prisma.friend.findMany({
      where: { userId: uid, name: { contains: q } },
      select: { name: true },
      take: 3,
    }),
  ])

  const suggestions = [
    ...memoirs.map((m) => ({ type: 'memoir' as const, text: m.title })),
    ...hobbies.map((h) => ({ type: 'hobby' as const, text: h.title })),
    ...friends.map((f) => ({ type: 'friend' as const, text: f.name })),
  ]
  res.json({ suggestions })
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
