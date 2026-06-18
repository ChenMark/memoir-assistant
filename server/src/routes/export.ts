/**
 * 数据导出路由（异步任务）
 * POST /export/memoir   单个回忆录 → PDF
 * POST /export/all      全部数据 → ZIP(JSON + 照片)
 * GET  /export/jobs     任务列表
 * GET  /export/:id/download  下载文件
 * DELETE /export/:id    删除任务
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'
import { generateDownloadUrl } from '../lib/oss.js'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { createReadStream } from 'node:fs'
import archiver from 'archiver'

const router = Router()
router.use(authMiddleware)

const exportDir = join(process.cwd(), 'exports')
// 确保导出目录存在
fs.mkdir(exportDir, { recursive: true }).catch(() => {})

// 创建导出任务
router.post('/memoir', async (req, res) => {
  const uid = userId(req)
  const parse = z.object({ memoirId: z.string() }).safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const { memoirId } = parse.data

  const memoir = await prisma.memoir.findFirst({ where: { id: memoirId, userId: uid } })
  if (!memoir) return res.status(404).json({ error: '回忆录不存在' })

  const job = await prisma.exportJob.create({
    data: {
      userId: uid,
      type: 'memoir',
      status: 'pending',
      meta: JSON.stringify({ memoirId, title: memoir.title }),
    },
  })

  // 异步处理
  processExportJob(job.id, 'memoir', { memoirId, userId: uid }).catch((err) => {
    console.error('[Export] failed:', err)
    prisma.exportJob
      .update({ where: { id: job.id }, data: { status: 'failed', error: err.message } })
      .catch(() => {})
  })

  res.json({ jobId: job.id, status: 'pending' })
})

router.post('/all', async (req, res) => {
  const uid = userId(req)
  const format = (req.body?.format as string) || 'zip' // zip | json

  const job = await prisma.exportJob.create({
    data: {
      userId: uid,
      type: 'all',
      status: 'pending',
      meta: JSON.stringify({ format }),
    },
  })

  processExportJob(job.id, 'all', { userId: uid, format }).catch((err) => {
    console.error('[Export-all] failed:', err)
    prisma.exportJob
      .update({ where: { id: job.id }, data: { status: 'failed', error: err.message } })
      .catch(() => {})
  })

  res.json({ jobId: job.id, status: 'pending' })
})

// 任务列表
router.get('/jobs', async (req, res) => {
  const uid = userId(req)
  const jobs = await prisma.exportJob.findMany({
    where: { userId: uid },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  res.json({ items: jobs.map(formatJob) })
})

// 下载
router.get('/:id/download', async (req, res) => {
  const uid = userId(req)
  const job = await prisma.exportJob.findFirst({ where: { id: req.params.id, userId: uid } })
  if (!job) return res.status(404).json({ error: '任务不存在' })
  if (job.status !== 'done' || !job.filePath) {
    return res.status(400).json({ error: '文件未就绪' })
  }

  try {
    await fs.access(job.filePath)
  } catch {
    return res.status(410).json({ error: '文件已过期或被删除' })
  }

  const filename = `${job.type}-${job.id}.${job.filePath.split('.').pop()}`
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  if (job.filePath.endsWith('.zip')) res.setHeader('Content-Type', 'application/zip')
  else if (job.filePath.endsWith('.pdf')) res.setHeader('Content-Type', 'application/pdf')
  else res.setHeader('Content-Type', 'application/json')

  createReadStream(job.filePath).pipe(res)
})

// 删除任务
router.delete('/:id', async (req, res) => {
  const uid = userId(req)
  const job = await prisma.exportJob.findFirst({ where: { id: req.params.id, userId: uid } })
  if (!job) return res.status(404).json({ error: '任务不存在' })

  if (job.filePath) {
    fs.unlink(job.filePath).catch(() => {})
  }
  await prisma.exportJob.delete({ where: { id: job.id } })
  res.json({ success: true })
})

function formatJob(j: any) {
  let meta: any = {}
  try { meta = JSON.parse(j.meta || '{}') } catch {}
  return {
    id: j.id,
    type: j.type,
    status: j.status,
    meta,
    error: j.error,
    downloadUrl: j.status === 'done' ? `/api/v1/export/${j.id}/download` : null,
    expiresAt: j.expiresAt?.toISOString(),
    createdAt: j.createdAt.toISOString(),
  }
}

async function processExportJob(
  jobId: string,
  type: 'memoir' | 'all',
  ctx: { memoirId?: string; userId: string; format?: string },
) {
  await prisma.exportJob.update({
    where: { id: jobId },
    data: { status: 'processing' },
  })

  if (type === 'memoir' && ctx.memoirId) {
    // 简化：用 JSON 形式（生产环境可接入 puppeteer/pdfkit 生成 PDF）
    const memoir = await prisma.memoir.findUnique({ where: { id: ctx.memoirId } })
    if (!memoir) throw new Error('回忆录不存在')

    const filePath = join(exportDir, `${jobId}.json`)
    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          title: memoir.title,
          content: memoir.content,
          date: memoir.date,
          tags: JSON.parse(memoir.tags || '[]'),
          mood: memoir.mood,
          createdAt: memoir.createdAt.toISOString(),
        },
        null,
        2,
      ),
      'utf-8',
    )
    await prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        filePath,
        fileSize: (await fs.stat(filePath)).size,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    return
  }

  if (type === 'all') {
    const [memoirs, photos, friends, hobbies, captures] = await Promise.all([
      prisma.memoir.findMany({ where: { userId: ctx.userId } }),
      prisma.gallery.findMany({ where: { userId: ctx.userId } }),
      prisma.friend.findMany({ where: { userId: ctx.userId } }),
      prisma.hobby.findMany({ where: { userId: ctx.userId } }),
      prisma.captureSession.findMany({ where: { userId: ctx.userId } }),
    ])

    const data = {
      exportedAt: new Date().toISOString(),
      userId: ctx.userId,
      memoirs: memoirs.map(serializeMemoir),
      photos: await Promise.all(
        photos.map(async (p) => ({
          ...p,
          downloadUrl: await generateDownloadUrl(p.ossKey).catch(() => null),
        })),
      ),
      friends: friends.map(serializeFriend),
      hobbies: hobbies.map(serializeHobby),
      captures: captures.map(serializeCapture),
    }

    const filePath = join(exportDir, `${jobId}.zip`)
    await new Promise<void>((resolve, reject) => {
      const output = require('fs').createWriteStream(filePath)
      const archiverLib: any = require('archiver')
      const archive = archiverLib('zip', { zlib: { level: 9 } })
      output.on('close', () => resolve())
      archive.on('error', (err: Error) => reject(err))
      archive.pipe(output)
      archive.append(JSON.stringify(data, null, 2), { name: 'memoir-export.json' })
      archive.append(
        `# 忆往昔数据导出\n\n导出时间：${new Date().toLocaleString('zh-CN')}\n\n` +
          `回忆录：${memoirs.length} 篇\n照片：${photos.length} 张\n亲友：${friends.length} 人\n爱好：${hobbies.length} 项\n采集：${captures.length} 次`,
        { name: 'README.md' },
      )
      archive.finalize()
    })

    await prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        filePath,
        fileSize: (await fs.stat(filePath)).size,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  }
}

function serializeMemoir(m: any) {
  return {
    id: m.id,
    title: m.title,
    content: m.content,
    date: m.date,
    tags: JSON.parse(m.tags || '[]'),
    mood: m.mood,
    createdAt: m.createdAt.toISOString(),
  }
}
function serializeFriend(f: any) {
  return { id: f.id, name: f.name, relation: f.relation, phone: f.phone, note: f.note }
}
function serializeHobby(h: any) {
  return {
    id: h.id,
    category: h.category,
    title: h.title,
    rating: h.rating,
    year: h.year,
    note: h.note,
  }
}
function serializeCapture(c: any) {
  return {
    id: c.id,
    type: c.type,
    date: c.date,
    transcript: c.transcript,
    duration: c.duration,
    itemCount: c.itemCount,
    ossKeys: JSON.parse(c.ossKeys || '[]'),
    tags: JSON.parse(c.tags || '[]'),
  }
}

export default router
