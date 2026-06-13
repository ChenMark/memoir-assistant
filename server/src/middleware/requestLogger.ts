/**
 * 请求日志中间件 — 结构化日志记录
 */
import { Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

/**
 * 请求日志中间件
 * 记录每个请求的详细信息：方法、路径、状态码、响应时间、用户ID等
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  const requestId = generateRequestId()
  
  // 将requestId附加到请求对象
  ;(req as any).requestId = requestId
  
  const { method, originalUrl, ip } = req
  const userAgent = req.get('user-agent') || ''
  const userId = (req as any).userId || 'anonymous'
  
  // 在响应完成时记录日志
  res.on('finish', () => {
    const duration = Date.now() - start
    const statusCode = res.statusCode
    const contentLength = res.get('content-length') || '0'
    
    const logLevel = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO'
    const statusIcon = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : statusCode >= 300 ? '↪️' : '✅'
    
    const logMessage = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      requestId,
      method,
      url: originalUrl,
      statusCode,
      duration,
      contentLength,
      userId,
      ip,
      userAgent: userAgent.substring(0, 100), // 截断避免日志过大
    }
    
    // 根据日志级别输出
    if (logLevel === 'ERROR') {
      console.error(`[${requestId}] ${statusIcon} ${method} ${originalUrl} ${statusCode} ${duration}ms`, logMessage)
    } else if (logLevel === 'WARN') {
      console.warn(`[${requestId}] ${statusIcon} ${method} ${originalUrl} ${statusCode} ${duration}ms`, logMessage)
    } else {
      console.log(`[${requestId}] ${statusIcon} ${method} ${originalUrl} ${statusCode} ${duration}ms`)
    }
  })
  
  next()
}
