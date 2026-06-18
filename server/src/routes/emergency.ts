/**
 * 紧急联系 + 隐私分组
 * GET  /emergency/contacts         紧急联系人列表
 * POST /emergency/contacts         添加紧急联系人
 * DELETE /emergency/contacts/:id   删除
 * POST /emergency/alert            触发紧急报警（记录 + 通知所有紧急联系人）
 *
 * GET  /privacy/circles            隐私分组列表（家人/朋友/同事/公开）
 * POST /privacy/circle             创建分组
 * PUT  /privacy/circle/:id         更新
 * DELETE /privacy/circle/:id       删除
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'
import { sendNotification } from './notification.js'

const router = Router()
router.use(authMiddleware)

// ===== Emergency Contacts =====
const contactSchema = z.object({
  name: z.string().min(1).max(50),
  phone: z.string().min(5).max(20),
  relation: z.string().min(1).max(20), // 儿子/女儿/配偶/邻居
  isPrimary: z.boolean().default(false),
})

router.get('/contacts', async (req, res) => {
  const uid = userId(req)
  const items = await prisma.emergencyContact.findMany({
    where: { userId: uid },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })
  res.json({ items })
})

router.post('/contacts', async (req, res) => {
  const uid = userId(req)
  const parse = contactSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const c = await prisma.emergencyContact.create({
    data: { userId: uid, ...parse.data },
  })
  res.json({ id: c.id, success: true })
})

router.delete('/contacts/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.emergencyContact.deleteMany({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (result.count === 0) return res.status(404).json({ error: '联系人不存在' })
  res.json({ success: true })
})

const alertSchema = z.object({
  message: z.string().max(200).optional(),
  location: z.string().optional(),
})

router.post('/alert', async (req, res) => {
  const uid = userId(req)
  const parse = alertSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })

  const contacts = await prisma.emergencyContact.findMany({
    where: { userId: uid, isPrimary: true },
  })
  if (contacts.length === 0) {
    return res.status(400).json({ error: '未设置主紧急联系人' })
  }

  // 记录报警
  const alert = await prisma.emergencyAlert.create({
    data: {
      userId: uid,
      message: parse.data.message || '紧急求助',
      location: parse.data.location,
      notifiedCount: contacts.length,
    },
  })

  // 通知所有主联系人
  await Promise.allSettled(
    contacts.map((c) =>
      sendNotification(
        uid,
        'system',
        `紧急求助：${c.name}`,
        `${parse.data.message || '紧急求助'}${parse.data.location ? ` (位置: ${parse.data.location})` : ''}`,
        '/emergency',
        { alertId: alert.id, contactId: c.id },
      ),
    ),
  )

  res.json({ alertId: alert.id, success: true, notified: contacts.length })
})

// ===== Privacy Circles =====
const circleSchema = z.object({
  name: z.string().min(1).max(30),
  description: z.string().max(200).optional(),
  color: z.string().optional(),
  memberIds: z.array(z.string()).default([]),
})

router.get('/circles', async (req, res) => {
  const uid = userId(req)
  const items = await prisma.privacyCircle.findMany({
    where: { userId: uid },
    orderBy: { createdAt: 'asc' },
  })
  res.json({ items: items.map((c) => ({ ...c, memberIds: safeParse(c.memberIds) })) })
})

router.post('/circle', async (req, res) => {
  const uid = userId(req)
  const parse = circleSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const c = await prisma.privacyCircle.create({
    data: {
      userId: uid,
      name: parse.data.name,
      description: parse.data.description,
      color: parse.data.color,
      memberIds: JSON.stringify(parse.data.memberIds),
    },
  })
  res.json({ id: c.id, success: true })
})

router.put('/circle/:id', async (req, res) => {
  const uid = userId(req)
  const existing = await prisma.privacyCircle.findFirst({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (!existing) return res.status(404).json({ error: '分组不存在' })
  const parse = circleSchema.partial().safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const data: any = { ...parse.data }
  if (data.memberIds) data.memberIds = JSON.stringify(data.memberIds)
  const updated = await prisma.privacyCircle.update({ where: { id: existing.id }, data })
  res.json({ id: updated.id, success: true })
})

router.delete('/circle/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.privacyCircle.deleteMany({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (result.count === 0) return res.status(404).json({ error: '分组不存在' })
  res.json({ success: true })
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
