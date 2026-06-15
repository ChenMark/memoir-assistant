/**
 * 爱好路由 — 金曲 / 电影 / 比赛 / 自定义
 */
import { Router, Request, Response } from 'express'
import { authMiddleware } from './auth.js'
import { prisma } from '../lib/prisma.js'
import { parsePagination, paginatedResponse } from '../lib/pagination.js'

const router = Router()
router.use(authMiddleware)

function userId(req: Request): string {
  return (req as any).userId as string
}

const VALID_CATEGORIES = ['music', 'movie', 'sport', 'custom']

/** GET /hobby — 获取所有爱好(按分类筛选，支持分页) */
router.get('/', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit)
    const { category } = req.query
    const where: any = { userId: uid }
    if (category && VALID_CATEGORIES.includes(category as string)) {
      where.category = category
    }

    const [hobbies, total] = await Promise.all([
      prisma.hobby.findMany({
        where, orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      prisma.hobby.count({ where }),
    ])

    const data = hobbies.map((h) => ({
      ...h,
      tags: JSON.parse(h.tags || '[]'),
    }))
    res.json(paginatedResponse(data, total, page, limit))
  } catch (err: any) {
    console.error('[hobby]', err.message)
    res.status(500).json({ error: '获取爱好列表失败' })
  }
})

/** POST /hobby — 添加爱好 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { category, title, description, rating, tags, year, link, imageKey } = req.body
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: '分类无效，可选: music/movie/sport/custom' })
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: '标题不能为空' })
    }
    if (title.length > 200) {
      return res.status(400).json({ error: '标题最多200个字符' })
    }

    const hobby = await prisma.hobby.create({
      data: {
        userId: uid,
        category,
        title: title.trim(),
        description: description || '',
        rating: rating ? Math.max(1, Math.min(5, Number(rating))) : null,
        tags: JSON.stringify(tags || []),
        year: year || null,
        link: link || null,
        imageKey: imageKey || null,
      },
    })
    res.status(201).json({ hobby: { ...hobby, tags: JSON.parse(hobby.tags || '[]') } })
  } catch (err: any) {
    console.error('[hobby POST]', err.message)
    res.status(500).json({ error: '添加爱好失败' })
  }
})

/** PUT /hobby/:id — 更新爱好 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const existing = await prisma.hobby.findFirst({
      where: { id: req.params.id, userId: uid },
    })
    if (!existing) return res.status(404).json({ error: '记录不存在' })

    const { category, title, description, rating, tags, year, link, imageKey } = req.body
    const updated = await prisma.hobby.update({
      where: { id: req.params.id },
      data: {
        ...(category && VALID_CATEGORIES.includes(category) ? { category } : {}),
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(rating !== undefined ? { rating: Math.max(1, Math.min(5, Number(rating))) } : {}),
        ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
        ...(year !== undefined ? { year } : {}),
        ...(link !== undefined ? { link } : {}),
        ...(imageKey !== undefined ? { imageKey } : {}),
      },
    })
    res.json({ hobby: { ...updated, tags: JSON.parse(updated.tags || '[]') } })
  } catch (err: any) {
    console.error('[hobby PUT]', err.message)
    res.status(500).json({ error: '更新爱好失败' })
  }
})

/** DELETE /hobby/:id — 删除爱好 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const existing = await prisma.hobby.findFirst({
      where: { id: req.params.id, userId: uid },
    })
    if (!existing) return res.status(404).json({ error: '记录不存在' })
    await prisma.hobby.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[hobby DELETE]', err.message)
    res.status(500).json({ error: '删除爱好失败' })
  }
})

export default router
