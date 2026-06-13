/**
 * 回忆录数据路由 — 回忆录 / 草稿 / 画廊的 CRUD（Prisma）
 */
import { Router, Request, Response } from 'express'
import { authMiddleware } from './auth.js'
import { prisma } from '../lib/prisma.js'
import {
  createMemoirSchema, updateMemoirSchema, saveDraftSchema,
  createGallerySchema,
} from '../validators/memoir.validator.js'
import crypto from 'node:crypto'

const router = Router()

// 所有回忆录/草稿路由都需要认证
router.use(authMiddleware)

function userId(req: Request): string {
  return (req as any).userId as string
}

function genId(): string {
  return `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

function nowISO(): string {
  return new Date().toISOString()
}

// ============ 回忆录 Memoir ===========

interface Memoir {
  id: string
  userId: string
  title: string
  content: string
  tags: string[]
  mood?: string
  location?: string
  date: string       // 回忆日期 YYYY-MM-DD
  media: string[]    // OSS key 列表
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

/** GET /memoir — 获取所有回忆录 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const memoirs = await prisma.memoir.findMany({
      where: { userId: uid },
      orderBy: { date: 'desc' }
    })
    const result: Memoir[] = memoirs.map(m => ({
      id: m.id,
      userId: m.userId,
      title: m.title,
      content: m.content,
      tags: JSON.parse(m.tags || '[]'),
      mood: m.mood || undefined,
      location: m.location || undefined,
      date: m.date,
      media: JSON.parse(m.media || '[]'),
      isPublished: m.isPublished,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }))
    res.json({ memoirs: result })
  } catch (err: any) {
    console.error('[memoir/]', err.message)
    res.status(500).json({ error: '获取回忆录失败' })
  }
})

/** GET /memoir/:id — 获取单个回忆录 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const memoir = await prisma.memoir.findFirst({
      where: { id: req.params.id, userId: uid }
    })
    if (!memoir) {
      return res.status(404).json({ error: '回忆录不存在' })
    }
    const result: Memoir = {
      id: memoir.id,
      userId: memoir.userId,
      title: memoir.title,
      content: memoir.content,
      tags: JSON.parse(memoir.tags || '[]'),
      mood: memoir.mood || undefined,
      location: memoir.location || undefined,
      date: memoir.date,
      media: JSON.parse(memoir.media || '[]'),
      isPublished: memoir.isPublished,
      createdAt: memoir.createdAt.toISOString(),
      updatedAt: memoir.updatedAt.toISOString(),
    }
    res.json({ memoir: result })
  } catch (err: any) {
    console.error('[memoir/:id]', err.message)
    res.status(500).json({ error: '获取回忆录失败' })
  }
})

/** POST /memoir — 创建回忆录 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = createMemoirSchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const uid = userId(req)
    const { title, content, date, tags, mood, location, media, isPublished } = validationResult.data

    const memoir = await prisma.memoir.create({
      data: {
        id: genId(),
        userId: uid,
        title: title.trim(),
        content: content || '',
        tags: JSON.stringify(tags || []),
        mood: mood || null,
        location: location || null,
        date,
        media: JSON.stringify(media || []),
        isPublished: true,
      }
    })
    const result: Memoir = {
      id: memoir.id,
      userId: memoir.userId,
      title: memoir.title,
      content: memoir.content,
      tags: JSON.parse(memoir.tags || '[]'),
      mood: memoir.mood || undefined,
      location: memoir.location || undefined,
      date: memoir.date,
      media: JSON.parse(memoir.media || '[]'),
      isPublished: memoir.isPublished,
      createdAt: memoir.createdAt.toISOString(),
      updatedAt: memoir.updatedAt.toISOString(),
    }
    res.status(201).json({ memoir: result })
  } catch (err: any) {
    console.error('[memoir POST]', err.message)
    res.status(500).json({ error: '创建回忆录失败' })
  }
})

/** PUT /memoir/:id — 更新回忆录 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = updateMemoirSchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const uid = userId(req)
    const { id, title, content, date, tags, mood, location, media, isPublished } = validationResult.data
    
    const existing = await prisma.memoir.findFirst({
      where: { id, userId: uid }
    })
    if (!existing) {
      return res.status(404).json({ error: '回忆录不存在' })
    }
    
    const updated = await prisma.memoir.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        content: content !== undefined ? content : existing.content,
        date: date !== undefined ? date : existing.date,
        tags: tags !== undefined ? JSON.stringify(tags) : existing.tags,
        mood: mood !== undefined ? mood : existing.mood,
        location: location !== undefined ? location : existing.location,
        media: media !== undefined ? JSON.stringify(media) : existing.media,
        isPublished: isPublished !== undefined ? isPublished : existing.isPublished,
        updatedAt: new Date(),
      }
    })
    const result: Memoir = {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      content: updated.content,
      tags: JSON.parse(updated.tags || '[]'),
      mood: updated.mood || undefined,
      location: updated.location || undefined,
      date: updated.date,
      media: JSON.parse(updated.media || '[]'),
      isPublished: updated.isPublished,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
    res.json({ memoir: result })
  } catch (err: any) {
    console.error('[memoir PUT]', err.message)
    res.status(500).json({ error: '更新回忆录失败' })
  }
})

/** DELETE /memoir/:id — 删除回忆录 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const existing = await prisma.memoir.findFirst({
      where: { id: req.params.id, userId: uid }
    })
    if (!existing) {
      return res.status(404).json({ error: '回忆录不存在' })
    }
    await prisma.memoir.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[memoir DELETE]', err.message)
    res.status(500).json({ error: '删除回忆录失败' })
  }
})

// ============ 草稿 Draft ===========

interface Draft {
  id: string
  userId: string
  title: string
  content: string
  tags: string[]
  mood?: string
  date?: string
  media: string[]
  createdAt: string
  updatedAt: string
}

/** GET /draft — 获取所有草稿 */
router.get('/draft', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const drafts = await prisma.draft.findMany({
      where: { userId: uid },
      orderBy: { updatedAt: 'desc' }
    })
    const result: Draft[] = drafts.map(d => ({
      id: d.id,
      userId: d.userId,
      title: d.title,
      content: d.content,
      tags: JSON.parse(d.tags || '[]'),
      mood: d.mood || undefined,
      date: d.date || undefined,
      media: JSON.parse(d.media || '[]'),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }))
    res.json({ drafts: result })
  } catch (err: any) {
    console.error('[draft/]', err.message)
    res.status(500).json({ error: '获取草稿失败' })
  }
})

/** POST /draft — 保存草稿 */
router.post('/draft', async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = saveDraftSchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const uid = userId(req)
    const { id, title, content, tags, mood, date, media } = validationResult.data
    const now = nowISO()

    if (id) {
      // 更新现有草稿
      const existing = await prisma.draft.findFirst({
        where: { id, userId: uid }
      })
      if (!existing) {
        return res.status(404).json({ error: '草稿不存在' })
      }
      const updated = await prisma.draft.update({
        where: { id },
        data: {
          title: title !== undefined ? title : existing.title,
          content: content !== undefined ? content : existing.content,
          tags: tags !== undefined ? JSON.stringify(tags) : existing.tags,
          mood: mood !== undefined ? mood : existing.mood,
          date: date !== undefined ? date : existing.date,
          media: media !== undefined ? JSON.stringify(media) : existing.media,
          updatedAt: new Date(),
        }
      })
      const result: Draft = {
        id: updated.id,
        userId: updated.userId,
        title: updated.title,
        content: updated.content,
        tags: JSON.parse(updated.tags || '[]'),
        mood: updated.mood || undefined,
        date: updated.date || undefined,
        media: JSON.parse(updated.media || '[]'),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      }
      res.json({ draft: result })
    } else {
      // 创建新草稿
      const draft = await prisma.draft.create({
        data: {
          id: genId(),
          userId: uid,
          title: title || '未命名草稿',
          content: content || '',
          tags: JSON.stringify(tags || []),
          mood: mood || null,
          date: date || null,
          media: JSON.stringify(media || []),
        }
      })
      const result: Draft = {
        id: draft.id,
        userId: draft.userId,
        title: draft.title,
        content: draft.content,
        tags: JSON.parse(draft.tags || '[]'),
        mood: draft.mood || undefined,
        date: draft.date || undefined,
        media: JSON.parse(draft.media || '[]'),
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
      }
      res.status(201).json({ draft: result })
    }
  } catch (err: any) {
    console.error('[draft POST]', err.message)
    res.status(500).json({ error: '保存草稿失败' })
  }
})

/** DELETE /draft/:id — 删除草稿 */
router.delete('/draft/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const existing = await prisma.draft.findFirst({
      where: { id: req.params.id, userId: uid }
    })
    if (!existing) {
      return res.status(404).json({ error: '草稿不存在' })
    }
    await prisma.draft.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[draft DELETE]', err.message)
    res.status(500).json({ error: '删除草稿失败' })
  }
})

// ============ 画廊 Gallery ===========

interface GalleryItem {
  id: string
  userId: string
  memoirId?: string
  ossKey: string
  caption: string
  tags: string[]
  date: string
  createdAt: string
}

/** GET /gallery — 获取画廊列表 */
router.get('/gallery', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const items = await prisma.gallery.findMany({
      where: { userId: uid },
      orderBy: { date: 'desc' }
    })
    const result: GalleryItem[] = items.map(item => ({
      id: item.id,
      userId: item.userId,
      memoirId: item.memoirId || undefined,
      ossKey: item.ossKey,
      caption: item.caption,
      tags: JSON.parse(item.tags || '[]'),
      date: item.date,
      createdAt: item.createdAt.toISOString(),
    }))
    res.json({ gallery: result })
  } catch (err: any) {
    console.error('[gallery]', err.message)
    res.status(500).json({ error: '获取画廊失败' })
  }
})

/** POST /gallery — 添加画廊图片 */
router.post('/gallery', async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = createGallerySchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const uid = userId(req)
    const { ossKey, caption, tags, date, memoirId } = validationResult.data

    const item = await prisma.gallery.create({
      data: {
        id: genId(),
        userId: uid,
        memoirId: memoirId || null,
        ossKey,
        caption: caption || '',
        tags: JSON.stringify(tags || []),
        date,
      }
    })
    const result: GalleryItem = {
      id: item.id,
      userId: item.userId,
      memoirId: item.memoirId || undefined,
      ossKey: item.ossKey,
      caption: item.caption,
      tags: JSON.parse(item.tags || '[]'),
      date: item.date,
      createdAt: item.createdAt.toISOString(),
    }
    res.status(201).json({ item: result })
  } catch (err: any) {
    console.error('[gallery POST]', err.message)
    res.status(500).json({ error: '添加画廊失败' })
  }
})

/** DELETE /gallery/:id — 删除画廊图片 */
router.delete('/gallery/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const existing = await prisma.gallery.findFirst({
      where: { id: req.params.id, userId: uid }
    })
    if (!existing) {
      return res.status(404).json({ error: '图片不存在' })
    }
    await prisma.gallery.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[gallery DELETE]', err.message)
    res.status(500).json({ error: '删除画廊失败' })
  }
})

export default router
