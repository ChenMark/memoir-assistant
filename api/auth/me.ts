import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken, findUserById, sanitizeUser } from './_utils'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '仅支持 GET 方法' })
  }

  try {
    // 从 Authorization header 提取 token
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

    if (!token) {
      return res.status(401).json({ error: '未提供认证令牌' })
    }

    // 验证 token
    const payload = verifyToken(token)
    if (!payload) {
      return res.status(401).json({ error: '令牌无效或已过期' })
    }

    // 查找用户
    const user = await findUserById(payload.sub)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    return res.status(200).json({
      user: sanitizeUser(user),
    })
  } catch (e: any) {
    console.error('[Me] 错误:', e)
    return res.status(500).json({ error: e.message || '服务器内部错误' })
  }
}
