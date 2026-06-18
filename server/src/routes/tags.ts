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

/**
 * 标签匹配：安全版本
 * ❌ 旧实现: tags: { contains: `"${from}"` }  ← JSON 字符串拼接注入
 * ✅ 新实现: 加载后应用层 contains 检查 + 安全字符白名单
 */
function matchesTag(tagsString: string, tag: string): boolean {
  // 1. 标签必须在白名单字符内（防止注入特殊字符）
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_\-\s]{1,30}$/.test(tag)) {
    return false
  }
  // 2. 应用层 contains 检查
  return safeParse(tagsString).includes(tag)
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

  // 限制 q 长度防滥用
  if (q.length > 30) return res.status(400).json({ error: '查询过长' })

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
const validateTag = (val: string): boolean => {
  // 允许：中文/英文/数字/_/-/空格，1-30 字符
  // 禁止：JSON 特殊字符（"\\[]{}）、HTML、控制字符
  if (typeof val !== 'string') return false
  if (val.length === 0 || val.length > 30) return false
  return /^[\u4e00-\u9fa5a-zA-Z0-9_\-\s]+$/.test(val)
}

const renameSchema = z.object({
  from: z.string().refine(validateTag, '标签包含非法字符'),
  to: z.string().refine(validateTag, '标签包含非法字符'),
})

router.put('/rename', async (req, res) => {
  const uid = userId(req)
  const parse = renameSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: '参数错误',
      details: parse.error.flatten().fieldErrors,
    })
  }
  const { from, to } = parse.data

  // ✅ 修复 B1：先查询用户所有记录（不依赖用户输入的 contains）
  //    然后应用层判断是否真的包含 from 标签
  const [memoirs, photos, hobbies] = await Promise.all([
    prisma.memoir.findMany({
      where: { userId: uid, NOT: { tags: '[]' } },
      select: { id: true, tags: true },
    }),
    prisma.gallery.findMany({
      where: { userId: uid, NOT: { tags: '[]' } },
      select: { id: true, tags: true },
    }),
    prisma.hobby.findMany({
      where: { userId: uid, NOT: { tags: '[]' } },
      select: { id: true, tags: true },
    }),
  ])

  // 应用层过滤：真正包含 from 标签的记录
  const memoirMatches = memoirs.filter((m) => matchesTag(m.tags, from))
  const photoMatches = photos.filter((p) => matchesTag(p.tags, from))
  const hobbyMatches = hobbies.filter((h) => matchesTag(h.tags, from))

  const updateOne = (tagsString: string): string => {
    const arr = safeParse(tagsString)
    const next = arr.map((t) => (t === from ? to : t))
    return JSON.stringify([...new Set(next)])
  }

  // ✅ 修复：使用事务保证原子性
  let updated = 0
  await prisma.$transaction(async (tx) => {
    for (const m of memoirMatches) {
      await tx.memoir.update({ where: { id: m.id }, data: { tags: updateOne(m.tags) } })
      updated++
    }
    for (const p of photoMatches) {
      await tx.gallery.update({ where: { id: p.id }, data: { tags: updateOne(p.tags) } })
      updated++
    }
    for (const h of hobbyMatches) {
      await tx.hobby.update({ where: { id: h.id }, data: { tags: updateOne(h.tags) } })
      updated++
    }
  })

  res.json({ success: true, updated, from, to })
})

// DELETE /tags/:name — 移除
router.delete('/:name', async (req, res) => {
  const uid = userId(req)
  const name = decodeURIComponent(req.params.name || '')

  // 1. 名称白名单校验
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_\-\s]{1,30}$/.test(name)) {
    return res.status(400).json({ error: '标签包含非法字符' })
  }

  // ✅ 同样修复：先查全部，应用层过滤
  const [memoirs, photos, hobbies] = await Promise.all([
    prisma.memoir.findMany({
      where: { userId: uid, NOT: { tags: '[]' } },
      select: { id: true, tags: true },
    }),
    prisma.gallery.findMany({
      where: { userId: uid, NOT: { tags: '[]' } },
      select: { id: true, tags: true },
    }),
    prisma.hobby.findMany({
      where: { userId: uid, NOT: { tags: '[]' } },
      select: { id: true, tags: true },
    }),
  ])

  const memoirMatches = memoirs.filter((m) => matchesTag(m.tags, name))
  const photoMatches = photos.filter((p) => matchesTag(p.tags, name))
  const hobbyMatches = hobbies.filter((h) => matchesTag(h.tags, name))

  const updateOne = (tagsString: string): string => {
    return JSON.stringify(safeParse(tagsString).filter((t) => t !== name))
  }

  let updated = 0
  await prisma.$transaction(async (tx) => {
    for (const m of memoirMatches) {
      await tx.memoir.update({ where: { id: m.id }, data: { tags: updateOne(m.tags) } })
      updated++
    }
    for (const p of photoMatches) {
      await tx.gallery.update({ where: { id: p.id }, data: { tags: updateOne(p.tags) } })
      updated++
    }
    for (const h of hobbyMatches) {
      await tx.hobby.update({ where: { id: h.id }, data: { tags: updateOne(h.tags) } })
      updated++
    }
  })

  res.json({ success: true, updated, name })
})

export default router
