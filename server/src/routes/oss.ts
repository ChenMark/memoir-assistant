/**
 * OSS 操作路由 — 签名 / 下载 / 删除 / 列表
 */
import { Router, Request, Response } from 'express'
import { authMiddleware } from './auth.js'
import { generateUploadUrl, generateDownloadUrl, deleteObject, listObjects } from '../lib/oss.js'

const router = Router()

// ============ POST /oss/sign — 生成上传签名 ============
router.post('/sign', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key, contentType, method = 'PUT' } = req.body
    if (!key) return res.status(400).json({ error: 'missing key' })
    const url = method === 'GET'
      ? await generateDownloadUrl(key)
      : await generateUploadUrl(key, contentType)
    res.json({ url })
  } catch (err: any) {
    console.error('[oss/sign]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ============ POST /oss/download — 生成下载签名 ============
router.post('/download', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: 'missing key' })
    const url = await generateDownloadUrl(key)
    res.json({ url })
  } catch (err: any) {
    console.error('[oss/download]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ============ POST /oss/delete — 删除对象 ============
router.post('/delete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: 'missing key' })
    await deleteObject(key)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[oss/delete]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ============ POST /oss/list — 列出对象 ============
router.post('/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { prefix } = req.body
    if (!prefix) return res.status(400).json({ error: 'missing prefix' })
    const keys = await listObjects(prefix)
    res.json({ keys })
  } catch (err: any) {
    console.error('[oss/list]', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
