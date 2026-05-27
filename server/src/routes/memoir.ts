/**
 * 回忆录数据路由 — 回忆录 / 草稿 / 画廊的 CRUD
 *
 * OSS 目录结构（按用户隔离）：
 *   memoir/users/{userId}/
 *     memoirs/        — 正式回忆录 {id}.json
 *     drafts/         — 草稿 {id}.json
 *     gallery/        — 画廊图片 {id}.json (元数据)
 *     timeline/       — 时间线 {id}.json
 *     media/          — 媒体文件（图片/视频）
 */
import { Router, Request, Response } from 'express'
import { authMiddleware } from './auth.js'
import { readJSON, writeJSON, listObjects, deleteObject, exists } from '../lib/oss.js'
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

// ============ 回忆录 Memoir ============

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

function memoirKey(userId: string, id: string): string {
  return `memoir/users/${userId}/memoirs/${id}.json`
}

function memoirPrefix(userId: string): string {
  return `memoir/users/${userId}/memoirs/`
}

/** GET /memoir — 获取所有回忆录 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const keys = await listObjects(memoirPrefix(uid), 500)
    const memoirs: Memoir[] = []
    for (const key of keys) {
      const m = await readJSON<Memoir>(key)
      if (m) memoirs.push(m)
    }
    memoirs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    res.json({ memoirs })
  } catch (err: any) {
    console.error('[memoir/]', err.message)
    res.status(500).json({ error: '获取回忆录失败' })
  }
})

/** GET /memoir/:id — 获取单个回忆录 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const key = memoirKey(userId(req), req.params.id)
    const memoir = await readJSON<Memoir>(key)
    if (!memoir || memoir.userId !== userId(req)) {
      return res.status(404).json({ error: '回忆录不存在' })
    }
    res.json({ memoir })
  } catch (err: any) {
    console.error('[memoir/:id]', err.message)
    res.status(500).json({ error: '获取回忆录失败' })
  }
})

/** POST /memoir — 创建回忆录 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { title, content, date, tags, mood, location, media } = req.body || {}
    if (!title || !date) return res.status(400).json({ error: '标题和日期为必填项' })

    const memoir: Memoir = {
      id: genId(),
      userId: uid,
      title: title.trim(),
      content: content || '',
      tags: tags || [],
      mood: mood || '',
      location: location || '',
      date,
      media: media || [],
      isPublished: true,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }

    await writeJSON(memoirKey(uid, memoir.id), memoir)
    res.status(201).json({ memoir })
  } catch (err: any) {
    console.error('[memoir POST]', err.message)
    res.status(500).json({ error: '创建回忆录失败' })
  }
})

/** PUT /memoir/:id — 更新回忆录 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const key = memoirKey(uid, req.params.id)
    const existing = await readJSON<Memoir>(key)
    if (!existing || existing.userId !== uid) {
      return res.status(404).json({ error: '回忆录不存在' })
    }

    const { title, content, date, tags, mood, location, media, isPublished } = req.body || {}
    const updated: Memoir = {
      ...existing,
      title: title !== undefined ? title.trim() : existing.title,
      content: content !== undefined ? content : existing.content,
      date: date !== undefined ? date : existing.date,
      tags: tags !== undefined ? tags : existing.tags,
      mood: mood !== undefined ? mood : existing.mood,
      location: location !== undefined ? location : existing.location,
      media: media !== undefined ? media : existing.media,
      isPublished: isPublished !== undefined ? isPublished : existing.isPublished,
      updatedAt: nowISO(),
    }
    await writeJSON(key, updated)
    res.json({ memoir: updated })
  } catch (err: any) {
    console.error('[memoir PUT]', err.message)
    res.status(500).json({ error: '更新回忆录失败' })
  }
})

/** DELETE /memoir/:id — 删除回忆录 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const key = memoirKey(uid, req.params.id)
    const existing = await readJSON<Memoir>(key)
    if (!existing || existing.userId !== uid) {
      return res.status(404).json({ error: '回忆录不存在' })
    }
    await deleteObject(key)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[memoir DELETE]', err.message)
    res.status(500).json({ error: '删除回忆录失败' })
  }
})

// ============ 草稿 Draft ============

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

function draftKey(userId: string, id: string): string {
  return `memoir/users/${userId}/drafts/${id}.json`
}

function draftPrefix(userId: string): string {
  return `memoir/users/${userId}/drafts/`
}

/** GET /draft — 获取所有草稿 */
router.get('/draft', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const keys = await listObjects(draftPrefix(uid), 500)
    const drafts: Draft[] = []
    for (const key of keys) {
      const d = await readJSON<Draft>(key)
      if (d) drafts.push(d)
    }
    drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    res.json({ drafts })
  } catch (err: any) {
    console.error('[draft/]', err.message)
    res.status(500).json({ error: '获取草稿失败' })
  }
})

/** POST /draft — 保存草稿 */
router.post('/draft', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { id, title, content, tags, mood, date, media } = req.body || {}
    const now = nowISO()

    let draft: Draft
    if (id) {
      const key = draftKey(uid, id)
      const existing = await readJSON<Draft>(key)
      if (!existing || existing.userId !== uid) {
        return res.status(404).json({ error: '草稿不存在' })
      }
      draft = {
        ...existing,
        title: title !== undefined ? title : existing.title,
        content: content !== undefined ? content : existing.content,
        tags: tags !== undefined ? tags : existing.tags,
        mood: mood !== undefined ? mood : existing.mood,
        date: date !== undefined ? date : existing.date,
        media: media !== undefined ? media : existing.media,
        updatedAt: now,
      }
    } else {
      draft = {
        id: genId(),
        userId: uid,
        title: title || '未命名草稿',
        content: content || '',
        tags: tags || [],
        mood,
        date,
        media: media || [],
        createdAt: now,
        updatedAt: now,
      }
    }

    await writeJSON(draftKey(uid, draft.id), draft)
    res.json({ draft })
  } catch (err: any) {
    console.error('[draft POST]', err.message)
    res.status(500).json({ error: '保存草稿失败' })
  }
})

/** DELETE /draft/:id — 删除草稿 */
router.delete('/draft/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const key = draftKey(uid, req.params.id)
    const existing = await readJSON<Draft>(key)
    if (!existing || existing.userId !== uid) {
      return res.status(404).json({ error: '草稿不存在' })
    }
    await deleteObject(key)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[draft DELETE]', err.message)
    res.status(500).json({ error: '删除草稿失败' })
  }
})

// ============ 画廊 Gallery（图片元数据）============

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

function galleryKey(userId: string, id: string): string {
  return `memoir/users/${userId}/gallery/${id}.json`
}

function galleryPrefix(userId: string): string {
  return `memoir/users/${userId}/gallery/`
}

/** GET /gallery — 获取画廊列表 */
router.get('/gallery', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const keys = await listObjects(galleryPrefix(uid), 500)
    const items: GalleryItem[] = []
    for (const key of keys) {
      const item = await readJSON<GalleryItem>(key)
      if (item) items.push(item)
    }
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    res.json({ gallery: items })
  } catch (err: any) {
    console.error('[gallery]', err.message)
    res.status(500).json({ error: '获取画廊失败' })
  }
})

/** POST /gallery — 添加画廊图片 */
router.post('/gallery', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { ossKey, caption, tags, date, memoirId } = req.body || {}
    if (!ossKey || !date) return res.status(400).json({ error: '图片地址和日期为必填项' })

    const item: GalleryItem = {
      id: genId(),
      userId: uid,
      memoirId,
      ossKey,
      caption: caption || '',
      tags: tags || [],
      date,
      createdAt: nowISO(),
    }
    await writeJSON(galleryKey(uid, item.id), item)
    res.status(201).json({ item })
  } catch (err: any) {
    console.error('[gallery POST]', err.message)
    res.status(500).json({ error: '添加画廊失败' })
  }
})

/** DELETE /gallery/:id — 删除画廊图片 */
router.delete('/gallery/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const key = galleryKey(uid, req.params.id)
    const existing = await readJSON<GalleryItem>(key)
    if (!existing || existing.userId !== uid) {
      return res.status(404).json({ error: '图片不存在' })
    }
    await deleteObject(key)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[gallery DELETE]', err.message)
    res.status(500).json({ error: '删除画廊图片失败' })
  }
})

export default router
