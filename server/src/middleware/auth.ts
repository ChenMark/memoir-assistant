/**
 * 认证中间件导出（统一入口）
 * 实际实现位于 routes/auth.ts
 */
import { Request } from 'express'

// 重新导出 auth.ts 的中间件
export { authMiddleware } from '../routes/auth.js'

/** 从 req 安全取出 userId（已由 authMiddleware 注入） */
export function userId(req: Request): string {
  return (req as any).userId
}

/** 可选认证：有 token 则解析，无 token 也不报错 */
export function optionalAuth(req: Request, _res: any, next: Function) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return next()
  // 复用 auth.ts 的 verifyToken
  try {
    const { verifyToken } = require('../lib/auth.js')
    const token = auth.slice(7)
    const payload = verifyToken(token)
    if (payload) {
      ;(req as any).userId = payload.sub
      ;(req as any).userEmail = payload.email
    }
  } catch {}
  next()
}

/** 给 Request 注入 token 字段的类型补丁 */
declare global {
  namespace Express {
    interface Request {
      token?: string
    }
  }
}
