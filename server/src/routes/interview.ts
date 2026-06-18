/**
 * AI 访谈存档
 * POST /interview/session           新建/获取当前会话
 * PUT  /interview/session/:id       更新阶段/答案
 * GET  /interview/session/:id       获取会话详情
 * GET  /interview/sessions          历史会话列表
 * POST /interview/session/:id/finalize 结束并生成大纲
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'
import { generateText } from '../lib/ai.js'

const router = Router()
router.use(authMiddleware)

const updateSchema = z.object({
  currentStage: z.number().int().min(0).max(20).optional(),
  answers: z.record(z.string(), z.any()).optional(),
  status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
})

// POST /interview/session — 创建
router.post('/session', async (req, res) => {
  const uid = userId(req)
  // 查找进行中的会话，没有则创建
  const existing = await prisma.interviewSession.findFirst({
    where: { userId: uid, status: 'in_progress' },
  })
  if (existing) {
    return res.json({ session: existing, continued: true })
  }
  const session = await prisma.interviewSession.create({
    data: { userId: uid, currentStage: 0, answers: '{}' },
  })
  res.json({ session, continued: false })
})

// PUT /interview/session/:id
router.put('/session/:id', async (req, res) => {
  const uid = userId(req)
  const parse = updateSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })

  const session = await prisma.interviewSession.findFirst({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (!session) return res.status(404).json({ error: '会话不存在' })

  const data: any = {}
  if (parse.data.currentStage !== undefined) data.currentStage = parse.data.currentStage
  if (parse.data.answers !== undefined) {
    // 合并答案
    let prev: any = {}
    try { prev = JSON.parse(session.answers) } catch {}
    data.answers = JSON.stringify({ ...prev, ...parse.data.answers })
  }
  if (parse.data.status !== undefined) data.status = parse.data.status

  const updated = await prisma.interviewSession.update({
    where: { id: session.id },
    data,
  })
  res.json({ session: updated })
})

// GET /interview/session/:id
router.get('/session/:id', async (req, res) => {
  const uid = userId(req)
  const session = await prisma.interviewSession.findFirst({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (!session) return res.status(404).json({ error: '会话不存在' })
  res.json({ session })
})

// GET /interview/sessions
router.get('/sessions', async (req, res) => {
  const uid = userId(req)
  const sessions = await prisma.interviewSession.findMany({
    where: { userId: uid },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  })
  res.json({ items: sessions })
})

// POST /interview/session/:id/finalize
router.post('/session/:id/finalize', async (req, res) => {
  const uid = userId(req)
  const session = await prisma.interviewSession.findFirst({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (!session) return res.status(404).json({ error: '会话不存在' })

  let answers: Record<string, any> = {}
  try { answers = JSON.parse(session.answers) } catch {}

  // AI 总结
  const prompt = `根据用户的访谈答案，生成一份回忆录大纲建议。

答案：
${Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n')}

输出格式（JSON）：
{
  "title": "建议的回忆录标题",
  "outline": ["章节1", "章节2", ...],
  "highlights": ["亮点1", "亮点2"]
}`

  let summary: any = { title: '我的回忆录', outline: [], highlights: [] }
  try {
    const text = await generateText(prompt)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) summary = JSON.parse(jsonMatch[0])
  } catch {}

  const updated = await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      status: 'completed',
      summary: JSON.stringify(summary),
    },
  })
  res.json({ session: updated, summary })
})

export default router
