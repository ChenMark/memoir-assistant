/**
 * 纪念日提醒
 * GET    /reminders          提醒列表
 * POST   /reminders          创建 { type, title, date, recurring }
 * PUT    /reminders/:id      更新
 * DELETE /reminders/:id      删除
 * GET    /reminders/upcoming 未来 30 天到期的提醒
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

const reminderSchema = z.object({
  type: z.enum(['birthday', 'anniversary', 'memorial', 'custom']),
  title: z.string().min(1).max(100),
  date: z.string(), // YYYY-MM-DD
  recurring: z.boolean().default(true),
  note: z.string().max(500).optional(),
  remindDays: z.array(z.number().int().min(0).max(30)).default([0, 1, 7, 30]), // 提前几天提醒
})

// GET /reminders
router.get('/', async (req, res) => {
  const uid = userId(req)
  const items = await prisma.reminder.findMany({
    where: { userId: uid },
    orderBy: { date: 'asc' },
  })
  res.json({ items })
})

// POST /reminders
router.post('/', async (req, res) => {
  const uid = userId(req)
  const parse = reminderSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ error: '参数错误', details: parse.error.flatten() })
  }
  const r = await prisma.reminder.create({
    data: {
      userId: uid,
      ...parse.data,
      remindDays: JSON.stringify(parse.data.remindDays),
    },
  })
  res.json({ id: r.id, success: true })
})

// PUT /reminders/:id
router.put('/:id', async (req, res) => {
  const uid = userId(req)
  const existing = await prisma.reminder.findFirst({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (!existing) return res.status(404).json({ error: '提醒不存在' })

  const parse = reminderSchema.partial().safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const data: any = { ...parse.data }
  if (data.remindDays) data.remindDays = JSON.stringify(data.remindDays)

  const updated = await prisma.reminder.update({ where: { id: existing.id }, data })
  res.json({ id: updated.id, success: true })
})

// DELETE /reminders/:id
router.delete('/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.reminder.deleteMany({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (result.count === 0) return res.status(404).json({ error: '提醒不存在' })
  res.json({ success: true })
})

// GET /reminders/upcoming?days=30
router.get('/upcoming', async (req, res) => {
  const uid = userId(req)
  const days = Math.min(90, Number(req.query.days) || 30)
  const reminders = await prisma.reminder.findMany({ where: { userId: uid } })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming: any[] = []
  for (const r of reminders) {
    let remindDays: number[] = []
    try { remindDays = JSON.parse(r.remindDays || '[0,1,7]') } catch {}
    const [, mm, dd] = r.date.split('-')

    for (let offset = 0; offset <= days; offset++) {
      const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
      // 周年匹配（按月日）
      if (r.recurring) {
        if (target.getMonth() + 1 === Number(mm) && target.getDate() === Number(dd)) {
          if (offset === 0) {
            upcoming.push({ ...r, daysUntil: 0, isToday: true })
          } else if (remindDays.includes(offset)) {
            upcoming.push({ ...r, daysUntil: offset, isToday: false })
          }
        }
      } else if (r.date === target.toISOString().slice(0, 10)) {
        upcoming.push({ ...r, daysUntil: offset, isToday: offset === 0 })
      }
    }
  }

  // 去重（同一条提醒只取最近的）
  const seen = new Set<string>()
  const unique = upcoming
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

  res.json({ items: unique.slice(0, 50) })
})

export default router
