/**
 * 标签管理 — 从 memoir/photo/hobby 中聚合统计
 * GET    /tags                标签云（含使用次数）
 * GET    /tags/suggest?q=     自动补全
 * PUT    /tags/rename         重命名全局标签
 * DELETE /tags/:name          删除标签（从所有记录中移除）
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

function safeParse(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

// GET /tags — 标签云
router.get('/', async (req, res) => {
  const uid = userId(req)
  const [memoirs, photos, hobbies] = await Promise.all([
    prisma.memoir.findMany({ where: { userId: uid }, select: { tags: true } }),
    prisma.gallery.findMany({ where: { userId: uid }, select: { tags: true } }),
    prisma.hobby.findMany({ where: { userId: uid }, select: { tags: true } }),
  ])

  const counts: Record<string, number> = {}
  const sources: Record<string, Set<string>> = {}
  const add = (arr: string[], source: string) => {
    arr.forEach((t) => {
      const tag = t.trim()
      if (!tag) return
      counts[tag] = (counts[tag] || 0) + 1
      if (!sources[tag]) sources[tag] = new Set()
      sources[tag].add(source)
    })
  }
  memoirs.forEach((m) => add(safeParse(m.tags), 'memoir'))
  photos.forEach((p) => add(safeParse(p.tags), 'photo'))
  hobbies.forEach((h) => add(safeParse(h.tags), 'hobby'))

  const cloud = Object.entries(counts)
    .map(([name, count]) => ({ name, count, sources: Array.from(sources[name] || []) }))
    .sort((a, b) => b.count - a.count)

  res.json({ items: cloud, total: cloud.length })
})

// GET /tags/suggest?q=
router.get('/suggest', async (req, res) => {
  const uid = userId(req)
  const q = String(req.query.q || '').trim().toLowerCase()
  if (!q) return res.json({ items: [] })

  const [memoirs, hobbies] = await Promise.all([
    prisma.memoir.findMany({ where: { userId: uid }, select: { tags: true } }),
    prisma.hobby.findMany({ where: { userId: uid }, select: { tags: true } }),
  ])
  const set = new Set<string>()
  memoirs.forEach((m) => safeParse(m.tags).forEach((t) => t.toLowerCase().includes(q) && set.add(t)))
  hobbies.forEach((h) => safeParse(h.tags).forEach((t) => t.toLowerCase().includes(q) && set.add(t)))

  res.json({ items: Array.from(set).slice(0, 20) })
})

// PUT /tags/rename
const renameSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
})

router.put('/rename', async (req, res) => {
  const uid = userId(req)
  const parse = renameSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const { from, to } = parse.data

  const [memoirs, photos, hobbies] = await Promise.all([
    prisma.memoir.findMany({ where: { userId: uid, tags: { contains: `"${from}"` } } }),
    prisma.gallery.findMany({ where: { userId: uid, tags: { contains: `"${from}"` } } }),
    prisma.hobby.findMany({ where: { userId: uid, tags: { contains: `"${from}"` } } }),
  ])

  const updateOne = async (tags: string) => {
    const arr = safeParse(tags)
    const next = arr.map((t) => (t === from ? to : t))
    // 去重
    return JSON.stringify([...new Set(next)])
  }

  let updated = 0
  for (const m of memoirs) {
    await prisma.memoir.update({ where: { id: m.id }, data: { tags: await updateOne(m.tags) } })
    updated++
  }
  for (const p of photos) {
    await prisma.gallery.update({ where: { id: p.id }, data: { tags: await updateOne(p.tags) } })
    updated++
  }
  for (const h of hobbies) {
    await prisma.hobby.update({ where: { id: h.id }, data: { tags: await updateOne(h.tags) } })
    updated++
  }

  res.json({ success: true, updated })
})

// DELETE /tags/:name — 移除
router.delete('/:name', async (req, res) => {
  const uid = userId(req)
  const name = decodeURIComponent(req.params.name)

  const updateOne = (tags: string) => {
    const arr = safeParse(tags).filter((t) => t !== name)
    return JSON.stringify(arr)
  }

  const [memoirs, photos, hobbies] = await Promise.all([
    prisma.memoir.findMany({ where: { userId: uid, tags: { contains: `"${name}"` } } }),
    prisma.gallery.findMany({ where: { userId: uid, tags: { contains: `"${name}"` } } }),
    prisma.hobby.findMany({ where: { userId: uid, tags: { contains: `"${name}"` } } }),
  ])

  let updated = 0
  for (const m of memoirs) {
    await prisma.memoir.update({ where: { id: m.id }, data: { tags: updateOne(m.tags) } })
    updated++
  }
  for (const p of photos) {
    await prisma.gallery.update({ where: { id: p.id }, data: { tags: updateOne(p.tags) } })
    updated++
  }
  for (const h of hobbies) {
    await prisma.hobby.update({ where: { id: h.id }, data: { tags: updateOne(h.tags) } })
    updated++
  }

  res.json({ success: true, updated })
})

export default router
