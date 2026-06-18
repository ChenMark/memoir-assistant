/**
 * 多设备会话管理
 * GET    /me/devices         活跃设备列表
 * DELETE /me/devices/:id     登出指定设备
 * POST   /me/devices/:id/refresh  续期 token
 * POST   /me/devices/logout-all 登出全部其他设备
 */
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'
import { generateToken } from '../lib/auth.js'
import crypto from 'node:crypto'
import { UAParser } from 'ua-parser-js'

const router = Router()
router.use(authMiddleware)

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function deviceId(): string {
  return crypto.randomBytes(16).toString('hex')
}

// GET /me/devices
router.get('/', async (req, res) => {
  const uid = userId(req)
  const currentTokenHash = hashToken(req.token!)
  const sessions = await prisma.session.findMany({
    where: { userId: uid, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: 'desc' },
  })

  const items = sessions.map((s) => {
    const parser = new UAParser(s.userAgent || '')
    const ua = parser.getResult()
    let meta: any = {}
    try { meta = JSON.parse(s.meta || '{}') } catch {}
    return {
      id: s.id,
      device: `${ua.os.name || 'Unknown'} · ${ua.browser.name || 'Unknown'}`,
      deviceId: s.deviceId,
      ip: s.ip,
      location: meta.location || null,
      lastActiveAt: s.lastActiveAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      isCurrent: s.tokenHash === currentTokenHash,
    }
  })
  res.json({ items })
})

// DELETE /me/devices/:id
router.delete('/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.session.deleteMany({
    where: { id: req.params.id, userId: uid },
  })
  if (result.count === 0) {
    return res.status(404).json({ error: '设备不存在' })
  }
  res.json({ success: true })
})

// POST /me/devices/:id/refresh
router.post('/:id/refresh', async (req, res) => {
  const uid = userId(req)
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: uid },
  })
  if (!session) return res.status(404).json({ error: '设备不存在' })

  const newToken = generateToken({ id: uid } as any)
  await prisma.session.update({
    where: { id: session.id },
    data: {
      tokenHash: hashToken(newToken),
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  res.json({ success: true, token: newToken })
})

// POST /me/devices/logout-all  登出其他所有设备
router.post('/logout-all', async (req, res) => {
  const uid = userId(req)
  const currentTokenHash = hashToken(req.token!)
  const result = await prisma.session.deleteMany({
    where: { userId: uid, NOT: { tokenHash: currentTokenHash } },
  })
  res.json({ success: true, deleted: result.count })
})

// 工具：创建新会话（auth.ts 调用）
export async function createSession(opts: {
  userId: string
  token: string
  userAgent?: string
  ip?: string
  location?: string
}) {
  return prisma.session.create({
    data: {
      userId: opts.userId,
      deviceId: deviceId(),
      tokenHash: hashToken(opts.token),
      userAgent: opts.userAgent,
      ip: opts.ip,
      meta: JSON.stringify({ location: opts.location }),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
}

export default router
