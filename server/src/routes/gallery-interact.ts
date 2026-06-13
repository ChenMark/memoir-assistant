/**
 * 画廊交互路由 — 评论 / 分享
 */
import { Router, Request, Response } from 'express'
import { authMiddleware } from './auth.js'
import { prisma } from '../lib/prisma.js'
import { generateDownloadUrl } from '../lib/oss.js'
import crypto from 'node:crypto'

const router = Router()
router.use(authMiddleware)

function userId(req: Request): string {
  return (req as any).userId as string
}

// ============ 评论 ============

/** GET /gallery/:id/comments — 获取照片评论 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await prisma.photoComment.findMany({
      where: { galleryId: req.params.id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    })
    res.json({ comments })
  } catch (err: any) {
    console.error('[gallery/comments]', err.message)
    res.status(500).json({ error: '获取评论失败' })
  }
})

/** POST /gallery/:id/comments — 添加评论 */
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const { content } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '评论内容不能为空' })
    }
    if (content.length > 500) {
      return res.status(400).json({ error: '评论最多500个字符' })
    }

    const gallery = await prisma.gallery.findFirst({
      where: { id: req.params.id }
    })
    if (!gallery) {
      return res.status(404).json({ error: '照片不存在' })
    }

    const comment = await prisma.photoComment.create({
      data: {
        galleryId: req.params.id,
        userId: uid,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    })

    res.status(201).json({ comment })
  } catch (err: any) {
    console.error('[gallery/comment]', err.message)
    res.status(500).json({ error: '添加评论失败' })
  }
})

/** DELETE /gallery/comments/:commentId — 删除评论 */
router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const comment = await prisma.photoComment.findUnique({
      where: { id: req.params.commentId }
    })
    if (!comment) {
      return res.status(404).json({ error: '评论不存在' })
    }
    if (comment.userId !== uid) {
      return res.status(403).json({ error: '无权删除他人评论' })
    }
    await prisma.photoComment.delete({ where: { id: req.params.commentId } })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[gallery/comment delete]', err.message)
    res.status(500).json({ error: '删除评论失败' })
  }
})

// ============ 分享 ============

/** POST /gallery/:id/share — 生成/获取分享令牌 */
router.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const gallery = await prisma.gallery.findFirst({
      where: { id: req.params.id, userId: uid }
    })
    if (!gallery) {
      return res.status(404).json({ error: '照片不存在' })
    }

    // 已有分享令牌则复用，否则生成新令牌
    let shareToken = gallery.shareToken
    if (!shareToken) {
      shareToken = crypto.randomBytes(16).toString('hex')
      await prisma.gallery.update({
        where: { id: req.params.id },
        data: { shareToken },
      })
    }

    // 生成分享链接
    const origin = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`
    const shareUrl = `${origin}/shared/photo/${shareToken}`

    res.json({ shareToken, shareUrl })
  } catch (err: any) {
    console.error('[gallery/share]', err.message)
    res.status(500).json({ error: '生成分享链接失败' })
  }
})

/** DELETE /gallery/:id/share — 撤销分享 */
router.delete('/:id/share', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const gallery = await prisma.gallery.findFirst({
      where: { id: req.params.id, userId: uid }
    })
    if (!gallery) {
      return res.status(404).json({ error: '照片不存在' })
    }
    await prisma.gallery.update({
      where: { id: req.params.id },
      data: { shareToken: null },
    })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[gallery/share revoke]', err.message)
    res.status(500).json({ error: '撤销分享失败' })
  }
})

/** GET /shared/photo/:token — 公开访问分享的照片（无需认证） */
export async function sharedPhotoHandler(req: Request, res: Response) {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { shareToken: req.params.token },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    })
    if (!gallery) {
      return res.status(404).json({ error: '分享链接无效或已失效' })
    }

    let downloadUrl: string
    try {
      downloadUrl = await generateDownloadUrl(gallery.ossKey)
    } catch {
      downloadUrl = ''
    }

    res.json({
      id: gallery.id,
      caption: gallery.caption,
      date: gallery.date,
      tags: JSON.parse(gallery.tags || '[]'),
      downloadUrl,
      owner: gallery.user,
    })
  } catch (err: any) {
    console.error('[gallery/shared]', err.message)
    res.status(500).json({ error: '获取分享照片失败' })
  }
}

export default router
