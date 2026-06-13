/**
 * 好友管理路由 — 好友的 CRUD（Prisma）
 */
import { Router, Request, Response } from 'express'
import { authMiddleware } from './auth.js'
import { prisma } from '../lib/prisma.js'
import crypto from 'node:crypto'

const router = Router()

// 所有好友路由都需要认证
router.use(authMiddleware)

function userId(req: Request): string {
  return (req as any).userId as string
}

function genId(): string {
  return `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

// ============ 好友接口定义 ============
interface Friend {
  id: string
  name: string
  avatar?: string
  addedAt: number
  category: 'family' | 'class_mate' | 'friend'
  // 家族树
  relationship?: string
  generation?: number  // 辈分：+2,+3,+4=祖辈，+1=父辈，0=同辈，-1,-2,-3=子、孙辈
  parentId?: string
  spouseId?: string  // 配偶ID，用于建立夫妻关系
  // 同学录
  school?: string
  classInfo?: string
  graduationYear?: string
  // 朋友圈
  metAt?: string
  metYear?: string
  tags?: string[]  // 标签，如工作单位、兴趣组等
}

// ============ GET /friend — 获取所有好友 ============
router.get('/', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const friends = await prisma.friend.findMany({
      where: { userId: uid },
      orderBy: { addedAt: 'desc' }
    })
    
    const result: Friend[] = friends.map(f => ({
      id: f.id,
      name: f.name,
      avatar: f.avatar || undefined,
      addedAt: f.addedAt.getTime(),
      category: f.category as 'family' | 'class_mate' | 'friend',
      relationship: f.relationship || undefined,
      generation: f.generation || undefined,
      parentId: f.parentId || undefined,
      spouseId: f.spouseId || undefined,
      school: f.school || undefined,
      classInfo: f.classInfo || undefined,
      graduationYear: f.graduationYear || undefined,
      metAt: f.metAt || undefined,
      metYear: f.metYear || undefined,
      tags: JSON.parse(f.tags || '[]'),
    }))
    
    res.json({ friends: result })
  } catch (err: any) {
    console.error('[friend/]', err.message)
    res.status(500).json({ error: '获取好友失败' })
  }
})

// ============ POST /friend — 添加好友 ============
router.post('/', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { name, avatar, category, relationship, generation, parentId, spouseId, school, classInfo, graduationYear, metAt, metYear, tags } = req.body || {}
    
    if (!name) return res.status(400).json({ error: '好友姓名为必填项' })
    if (!category) return res.status(400).json({ error: '好友分类为必填项' })
    
    const friend = await prisma.friend.create({
      data: {
        id: genId(),
        userId: uid,
        name: name.trim(),
        avatar: avatar || null,
        category: category,
        relationship: relationship || null,
        generation: generation || null,
        parentId: parentId || null,
        spouseId: spouseId || null,
        school: school || null,
        classInfo: classInfo || null,
        graduationYear: graduationYear || null,
        metAt: metAt || null,
        metYear: metYear || null,
        tags: JSON.stringify(tags || []),
      }
    }))
    
    const result: Friend = {
      id: friend.id,
      name: friend.name,
      avatar: friend.avatar || undefined,
      addedAt: friend.addedAt.getTime(),
      category: friend.category as 'family' | 'class_mate' | 'friend',
      relationship: friend.relationship || undefined,
      generation: friend.generation || undefined,
      parentId: friend.parentId || undefined,
      spouseId: friend.spouseId || undefined,
      school: friend.school || undefined,
      classInfo: friend.classInfo || undefined,
      graduationYear: friend.graduationYear || undefined,
      metAt: friend.metAt || undefined,
      metYear: friend.metYear || undefined,
      tags: JSON.parse(friend.tags || '[]'),
    }
    
    res.status(201).json({ friend: result })
  } catch (err: any) {
    console.error('[friend POST]', err.message)
    res.status(500).json({ error: '添加好友失败' })
  }
})

// ============ PUT /friend/:id — 更新好友 ============
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const existing = await prisma.friend.findFirst({
      where: { id: req.params.id, userId: uid }
    }))
    
    if (!existing) {
      return res.status(404).json({ error: '好友不存在' })
    }
    
    const { name, avatar, category, relationship, generation, parentId, spouseId, school, classInfo, graduationYear, metAt, metYear, tags } = req.body || {}
    
    const updated = await prisma.friend.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        avatar: avatar !== undefined ? avatar : existing.avatar,
        category: category !== undefined ? category : existing.category,
        relationship: relationship !== undefined ? relationship : existing.relationship,
        generation: generation !== undefined ? generation : existing.generation,
        parentId: parentId !== undefined ? parentId : existing.parentId,
        spouseId: spouseId !== undefined ? spouseId : existing.spouseId,
        school: school !== undefined ? school : existing.school,
        classInfo: classInfo !== undefined ? classInfo : existing.classInfo,
        graduationYear: graduationYear !== undefined ? graduationYear : existing.graduationYear,
        metAt: metAt !== undefined ? metAt : existing.metAt,
        metYear: metYear !== undefined ? metYear : existing.metYear,
        tags: tags !== undefined ? JSON.stringify(tags) : existing.tags,
        updatedAt: new Date(),
      }
    }))
    
    const result: Friend = {
      id: updated.id,
      name: updated.name,
      avatar: updated.avatar || undefined,
      addedAt: updated.addedAt.getTime(),
      category: updated.category as 'family' | 'class_mate' | 'friend',
      relationship: updated.relationship || undefined,
      generation: updated.generation || undefined,
      parentId: updated.parentId || undefined,
      spouseId: updated.spouseId || undefined,
      school: updated.school || undefined,
      classInfo: updated.classInfo || undefined,
      graduationYear: updated.graduationYear || undefined,
      metAt: updated.metAt || undefined,
      metYear: updated.metYear || undefined,
      tags: JSON.parse(updated.tags || '[]'),
    }
    
    res.json({ friend: result })
  } catch (err: any) {
    console.error('[friend PUT]', err.message)
    res.status(500).json({ error: '更新好友失败' })
  }
})

// ============ DELETE /friend/:id — 删除好友 ============
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const existing = await prisma.friend.findFirst({
      where: { id: req.params.id, userId: uid }
    }))
    
    if (!existing) {
      return res.status(404).json({ error: '好友不存在' })
    }
    
    await prisma.friend.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[friend DELETE]', err.message)
    res.status(500).json({ error: '删除好友失败' })
  }
})

export default router
