/**
 * 缓存控制中间件
 * 为 GET 请求添加 ETag 和 Cache-Control 头
 */
import { Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'

/**
 * 为 JSON 响应添加 ETag
 * 客户端可在后续请求中携带 If-None-Match，匹配时返回 304 Not Modified
 */
export function etagMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET') return next()

  const originalJson = res.json.bind(res)

  res.json = function (body: any) {
    // 跳过错误响应
    if (res.statusCode >= 400) {
      return originalJson(body)
    }

    const etag = crypto
      .createHash('md5')
      .update(JSON.stringify(body))
      .digest('hex')
      .slice(0, 12)

    res.setHeader('ETag', `"${etag}"`)

    // 短时客户端缓存（60s），允许 stale-while-revalidate
    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300')

    // 检查 If-None-Match
    const ifNoneMatch = req.headers['if-none-match']
    if (ifNoneMatch && ifNoneMatch === `"${etag}"`) {
      res.status(304).end()
      return res
    }

    return originalJson(body)
  }

  next()
}

/**
 * 长缓存控制（用于不常变化的资源）
 */
export function longCache(maxAge: number = 86400) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, immutable`)
    next()
  }
}
