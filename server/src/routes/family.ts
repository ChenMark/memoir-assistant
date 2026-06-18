/**
 * 家族图谱
 * GET  /family/tree       获取完整家族树（含成员关系）
 * GET  /family/relations  关系列表（人物间的关系图）
 * POST /family/relation   创建人物间关系
 * DELETE /family/relation/:id
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

const relationSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  type: z.enum(['spouse', 'parent', 'child', 'sibling']),
})

// GET /family/tree — 树状结构
router.get('/tree', async (req, res) => {
  const uid = userId(req)
  const friends = await prisma.friend.findMany({
    where: { userId: uid },
    orderBy: { generation: 'asc' },
  })

  // 根节点：同辈 + 用户自己
  const root = friends.filter((f) => (f.generation || 0) === 0)
  const ancestors = friends.filter((f) => (f.generation || 0) > 0)
  const descendants = friends.filter((f) => (f.generation || 0) < 0)

  res.json({
    root: root.map(serializeMember),
    ancestors: ancestors.map(serializeMember),
    descendants: descendants.map(serializeMember),
    total: friends.length,
  })
})

router.get('/relations', async (req, res) => {
  const uid = userId(req)
  const relations = await prisma.familyRelation.findMany({
    where: { userId: uid },
  })
  res.json({ items: relations })
})

router.post('/relation', async (req, res) => {
  const uid = userId(req)
  const parse = relationSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })

  const r = await prisma.familyRelation.create({
    data: { userId: uid, ...parse.data },
  })
  res.json({ id: r.id, success: true })
})

router.delete('/relation/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.familyRelation.deleteMany({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (result.count === 0) return res.status(404).json({ error: '关系不存在' })
  res.json({ success: true })
})

function serializeMember(f: any) {
  return {
    id: f.id,
    name: f.name,
    avatar: f.avatar,
    relationship: f.relationship,
    category: f.category,
    generation: f.generation,
    school: f.school,
    classInfo: f.classInfo,
  }
}

export default router
