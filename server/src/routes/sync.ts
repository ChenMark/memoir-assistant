/**
 * 离线同步（增量）
 * GET  /sync/changes?since=ISO时间戳&types=memoir,photo
 *   返回该时间戳之后变更的全部记录
 * POST /sync/upload
 *   客户端批量上传本地变更（含 clientId 用于幂等去重）
 *   解决冲突：最后写入获胜（LWW）但保留原 updatedAt 备份
 *
 * 关键点：
 *  - 每条记录带 clientId（客户端生成） + updatedAt
 *  - 上传时携带 updatedAt，服务端用 last-write-wins
 *  - 离线时本地存储，联网后批量同步
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

const changesQuerySchema = z.object({
  since: z.string().optional(), // ISO 8601
  types: z.string().optional(), // 逗号分隔 memoir,photo,friend,hobby,capture
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

// GET /sync/changes
router.get('/changes', async (req, res) => {
  const uid = userId(req)
  const parse = changesQuerySchema.safeParse(req.query)
  if (!parse.success) {
    return res.status(400).json({ error: '参数错误' })
  }
  const since = parse.data.since ? new Date(parse.data.since) : new Date(0)
  const types = parse.data.types
    ? parse.data.types.split(',').map((t) => t.trim())
    : ['memoir', 'photo', 'friend', 'hobby', 'capture']
  const limit = parse.data.limit

  const tasks: Promise<{ type: string; items: any[] }>[] = []
  if (types.includes('memoir')) {
    tasks.push(
      prisma.memoir
        .findMany({
          where: { userId: uid, updatedAt: { gt: since } },
          orderBy: { updatedAt: 'asc' },
          take: limit,
        })
        .then((items) => ({
          type: 'memoir',
          items: items.map((m) => ({
            id: m.id,
            clientId: m.id,
            title: m.title,
            content: m.content,
            date: m.date,
            tags: JSON.parse(m.tags || '[]'),
            mood: m.mood,
            updatedAt: m.updatedAt.toISOString(),
            deleted: false,
          })),
        })),
    )
  }
  if (types.includes('photo')) {
    tasks.push(
      prisma.gallery
        .findMany({
          where: { userId: uid, createdAt: { gt: since } },
          orderBy: { createdAt: 'asc' },
          take: limit,
        })
        .then((items) => ({
          type: 'photo',
          items: items.map((g) => ({
            id: g.id,
            clientId: g.id,
            ossKey: g.ossKey,
            caption: g.caption,
            date: g.date,
            tags: JSON.parse(g.tags || '[]'),
            updatedAt: g.createdAt.toISOString(),
            deleted: false,
          })),
        })),
    )
  }
  if (types.includes('friend')) {
    tasks.push(
      prisma.friend
        .findMany({
          where: { userId: uid, updatedAt: { gt: since } },
          orderBy: { updatedAt: 'asc' },
          take: limit,
        })
        .then((items) => ({
          type: 'friend',
          items: items.map((f) => ({
            id: f.id,
            clientId: f.id,
            name: f.name,
            relationship: f.relationship,
            school: f.school,
            classInfo: f.classInfo,
            updatedAt: f.updatedAt.toISOString(),
            deleted: false,
          })),
        })),
    )
  }
  if (types.includes('hobby')) {
    tasks.push(
      prisma.hobby
        .findMany({
          where: { userId: uid, updatedAt: { gt: since } },
          orderBy: { updatedAt: 'asc' },
          take: limit,
        })
        .then((items) => ({
          type: 'hobby',
          items: items.map((h) => ({
            id: h.id,
            clientId: h.id,
            category: h.category,
            title: h.title,
            rating: h.rating,
            year: h.year,
            description: h.description,
            updatedAt: h.updatedAt.toISOString(),
            deleted: false,
          })),
        })),
    )
  }
  if (types.includes('capture')) {
    tasks.push(
      prisma.captureSession
        .findMany({
          where: { userId: uid, createdAt: { gt: since } },
          orderBy: { createdAt: 'asc' },
          take: limit,
        })
        .then((items) => ({
          type: 'capture',
          items: items.map((c) => ({
            id: c.id,
            clientId: c.id,
            type: c.type,
            date: c.date,
            transcript: c.transcript,
            duration: c.duration,
            itemCount: c.itemCount,
            ossKeys: JSON.parse(c.ossKeys || '[]'),
            tags: JSON.parse(c.tags || '[]'),
            updatedAt: c.createdAt.toISOString(),
            deleted: false,
          })),
        })),
    )
  }

  const results = await Promise.all(tasks)
  const merged: Record<string, any[]> = {}
  results.forEach((r) => { merged[r.type] = r.items })

  // 服务器时间戳（客户端用来作为下次 since）
  const serverTime = new Date().toISOString()
  res.json({ serverTime, changes: merged })
})

const uploadSchema = z.object({
  operations: z.array(z.object({
    type: z.enum(['memoir', 'photo', 'friend', 'hobby', 'capture']),
    action: z.enum(['create', 'update', 'delete']),
    clientId: z.string(),
    payload: z.record(z.string(), z.any()).optional(),
    clientUpdatedAt: z.string(),
  })),
})

// POST /sync/upload
router.post('/upload', async (req, res) => {
  const uid = userId(req)
  const parse = uploadSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ error: '参数错误', details: parse.error.flatten() })
  }

  const results: any[] = []
  const conflicts: any[] = []

  for (const op of parse.data.operations) {
    const clientTs = new Date(op.clientUpdatedAt)

    try {
      if (op.type === 'memoir') {
        if (op.action === 'delete') {
          const r = await prisma.memoir.deleteMany({
            where: { id: op.clientId, userId: uid },
          })
          results.push({ clientId: op.clientId, type: op.type, action: 'delete', success: r.count > 0 })
          continue
        }
        const existing = op.clientId
          ? await prisma.memoir.findFirst({ where: { id: op.clientId, userId: uid } })
          : null

        if (existing) {
          // 冲突检测：服务端 updatedAt > 客户端时间戳 → 冲突
          if (existing.updatedAt > clientTs) {
            conflicts.push({
              clientId: op.clientId,
              type: op.type,
              server: {
                id: existing.id,
                title: existing.title,
                content: existing.content,
                updatedAt: existing.updatedAt.toISOString(),
              },
              client: op.payload,
            })
            continue
          }
          const updated = await prisma.memoir.update({
            where: { id: existing.id },
            data: {
              title: op.payload?.title as string,
              content: op.payload?.content as string,
              date: op.payload?.date as string,
              tags: JSON.stringify(op.payload?.tags || []),
              mood: (op.payload?.mood as string) || null,
              updatedAt: clientTs,
            },
          })
          results.push({ clientId: op.clientId, serverId: updated.id, action: 'update', success: true })
        } else {
          const created = await prisma.memoir.create({
            data: {
              id: op.clientId,
              userId: uid,
              title: op.payload?.title as string,
              content: op.payload?.content as string,
              date: op.payload?.date as string,
              tags: JSON.stringify(op.payload?.tags || []),
              mood: (op.payload?.mood as string) || null,
              media: '[]',
              createdAt: clientTs,
              updatedAt: clientTs,
            },
          })
          results.push({ clientId: op.clientId, serverId: created.id, action: 'create', success: true })
        }
      } else if (op.type === 'friend') {
        if (op.action === 'delete') {
          await prisma.friend.deleteMany({ where: { id: op.clientId, userId: uid } })
          results.push({ clientId: op.clientId, type: op.type, action: 'delete', success: true })
          continue
        }
        const existing = await prisma.friend.findFirst({ where: { id: op.clientId, userId: uid } })
        if (existing && existing.updatedAt > clientTs) {
          conflicts.push({ clientId: op.clientId, type: op.type, server: existing, client: op.payload })
          continue
        }
        if (existing) {
          await prisma.friend.update({
            where: { id: existing.id },
            data: {
              name: op.payload?.name as string,
              category: (op.payload?.category as string) || 'friend',
              relationship: (op.payload?.relationship as string) || (op.payload?.relation as string) || null,
              school: (op.payload?.school as string) || null,
              classInfo: (op.payload?.classInfo as string) || null,
              updatedAt: clientTs,
            },
          })
          results.push({ clientId: op.clientId, action: 'update', success: true })
        } else {
          await prisma.friend.create({
            data: {
              id: op.clientId,
              userId: uid,
              name: op.payload?.name as string,
              category: (op.payload?.category as string) || 'friend',
              relationship: (op.payload?.relationship as string) || (op.payload?.relation as string) || null,
              school: (op.payload?.school as string) || null,
              classInfo: (op.payload?.classInfo as string) || null,
              tags: JSON.stringify(op.payload?.tags || []),
              createdAt: clientTs,
              updatedAt: clientTs,
            },
          })
          results.push({ clientId: op.clientId, action: 'create', success: true })
        }
      } else if (op.type === 'hobby') {
        if (op.action === 'delete') {
          await prisma.hobby.deleteMany({ where: { id: op.clientId, userId: uid } })
          results.push({ clientId: op.clientId, action: 'delete', success: true })
          continue
        }
        const existing = await prisma.hobby.findFirst({ where: { id: op.clientId, userId: uid } })
        if (existing && existing.updatedAt > clientTs) {
          conflicts.push({ clientId: op.clientId, type: op.type, server: existing, client: op.payload })
          continue
        }
        if (existing) {
          await prisma.hobby.update({
            where: { id: existing.id },
            data: {
              category: op.payload?.category as string,
              title: op.payload?.title as string,
              description: (op.payload?.description as string) || (op.payload?.note as string) || '',
              rating: (op.payload?.rating as number) || 0,
              year: (op.payload?.year as string) || null,
              tags: JSON.stringify(op.payload?.tags || []),
              updatedAt: clientTs,
            },
          })
          results.push({ clientId: op.clientId, action: 'update', success: true })
        } else {
          await prisma.hobby.create({
            data: {
              id: op.clientId,
              userId: uid,
              category: op.payload?.category as string,
              title: op.payload?.title as string,
              description: (op.payload?.description as string) || (op.payload?.note as string) || '',
              rating: (op.payload?.rating as number) || 0,
              year: (op.payload?.year as string) || null,
              tags: JSON.stringify(op.payload?.tags || []),
              createdAt: clientTs,
              updatedAt: clientTs,
            },
          })
          results.push({ clientId: op.clientId, action: 'create', success: true })
        }
      }
    } catch (err) {
      results.push({
        clientId: op.clientId,
        type: op.type,
        success: false,
        error: (err as Error).message,
      })
    }
  }

  res.json({
    serverTime: new Date().toISOString(),
    results,
    conflicts,
  })
})

export default router
