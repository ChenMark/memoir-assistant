/**
 * 收藏 + EXIF
 * POST   /bookmarks          添加收藏 { targetType, targetId }
 * DELETE /bookmarks/:id      取消收藏
 * GET    /bookmarks          收藏列表（按类型筛选）
 * GET    /exif?key=          解析照片 EXIF 元数据
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'
import { getObjectBuffer, generateDownloadUrl } from '../lib/oss.js'

const router = Router()
router.use(authMiddleware)

// ===== Bookmarks =====
const addBookmarkSchema = z.object({
  targetType: z.enum(['memoir', 'photo', 'hobby', 'friend']),
  targetId: z.string(),
  note: z.string().max(200).optional(),
})

// GET /bookmarks
router.get('/', async (req, res) => {
  const uid = userId(req)
  const type = req.query.type as string | undefined
  const items = await prisma.bookmark.findMany({
    where: {
      userId: uid,
      ...(type ? { targetType: type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ items })
})

// POST /bookmarks
router.post('/', async (req, res) => {
  const uid = userId(req)
  const parse = addBookmarkSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })

  // 检查是否已收藏
  const existing = await prisma.bookmark.findFirst({
    where: {
      userId: uid,
      targetType: parse.data.targetType,
      targetId: parse.data.targetId,
    },
  })
  if (existing) return res.json({ id: existing.id, success: true, existed: true })

  const bookmark = await prisma.bookmark.create({
    data: {
      userId: uid,
      targetType: parse.data.targetType,
      targetId: parse.data.targetId,
      note: parse.data.note,
    },
  })
  res.json({ id: bookmark.id, success: true })
})

// DELETE /bookmarks/:id
router.delete('/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.bookmark.deleteMany({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (result.count === 0) return res.status(404).json({ error: '收藏不存在' })
  res.json({ success: true })
})

// ===== EXIF =====
router.get('/exif', async (req, res) => {
  const key = String(req.query.key || '')
  if (!key) return res.status(400).json({ error: '缺少 key' })

  try {
    const buf = await getObjectBuffer(key)
    const exif = parseExif(buf)
    const downloadUrl = await generateDownloadUrl(key)
    res.json({ key, downloadUrl, exif })
  } catch (err) {
    res.status(500).json({ error: 'EXIF 解析失败', detail: (err as Error).message })
  }
})

/**
 * 极简 EXIF 解析器（仅 JPEG 基础字段）
 * 不依赖第三方库，避免包体积
 */
function parseExif(buf: Buffer): Record<string, any> {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return { format: 'unknown' }
  }
  const result: Record<string, any> = { format: 'jpeg' }
  let offset = 2
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) break
    const marker = buf[offset + 1]
    // SOF 标记（图像信息）
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8) {
      result.height = buf.readUInt16BE(offset + 5)
      result.width = buf.readUInt16BE(offset + 7)
      break
    }
    if (marker === 0xe1) {
      // APP1 - EXIF
      const size = buf.readUInt16BE(offset + 2)
      const exifBuf = buf.subarray(offset + 4, offset + 2 + size)
      const tiffStart = exifBuf.indexOf(Buffer.from([0x49, 0x49])) // "II" little-endian
      if (tiffStart >= 0) {
        result.hasExif = true
        // 提取 DateTimeOriginal（tag 0x9003）
        const dateTime = extractExifString(exifBuf, 0x9003)
        if (dateTime) result.dateTimeOriginal = dateTime.replace(/:/, '-').replace(/:/, '-')
        const make = extractExifString(exifBuf, 0x010f)
        if (make) result.make = make
        const model = extractExifString(exifBuf, 0x0110)
        if (model) result.model = model
      }
      break
    }
    if (marker === 0xda) break // SOS 之后是图像数据，停止
    const size = buf.readUInt16BE(offset + 2)
    offset += 2 + size
  }
  return result
}

function extractExifString(exifBuf: Buffer, tag: number): string | null {
  // 简化的 EXIF 字符串提取（仅支持 ASCII）
  // 不做完整 TIFF 解析
  const needle = Buffer.from([tag & 0xff, (tag >> 8) & 0xff])
  const idx = exifBuf.indexOf(needle)
  if (idx < 0 || idx + 10 > exifBuf.length) return null
  // 检查类型 (type 在 tag 后 2 字节，type=2 表示 ASCII)
  if (exifBuf[idx + 2] !== 2) return null
  const len = exifBuf.readUInt32LE(idx + 4)
  if (idx + 8 + len > exifBuf.length) return null
  return exifBuf.subarray(idx + 8, idx + 8 + len - 1).toString('utf-8').replace(/\0$/, '')
}

export default router
