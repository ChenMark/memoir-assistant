/**
 * 错误处理中间件 — 统一错误处理和响应格式
 */
import { Request, Response, NextFunction } from 'express'

/**
 * 自定义应用错误类
 */
export class AppError extends Error {
  statusCode: number
  code: string
  details?: any

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

/**
 * 认证错误
 */
export class AuthError extends AppError {
  constructor(message: string = '未授权') {
    super(message, 401, 'AUTH_ERROR')
  }
}

/**
 * 权限错误
 */
export class ForbiddenError extends AppError {
  constructor(message: string = '无权限') {
    super(message, 403, 'FORBIDDEN_ERROR')
  }
}

/**
 * 资源不存在错误
 */
export class NotFoundError extends AppError {
  constructor(message: string = '资源不存在') {
    super(message, 404, 'NOT_FOUND')
  }
}

/**
 * 冲突错误（如重复注册）
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR')
  }
}

/**
 * 限流错误
 */
export class RateLimitError extends AppError {
  constructor(message: string = '请求过于频繁') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // 记录错误日志
  const timestamp = new Date().toISOString()
  const requestId = (req as any).requestId || 'unknown'
  const userId = (req as any).userId || 'anonymous'
  
  console.error(`[${timestamp}] [${requestId}] [ERROR] ${err.message}`, {
    stack: err.stack,
    userId,
    path: req.path,
    method: req.method,
    body: process.env.NODE_ENV === 'development' ? req.body : undefined
  })

  // 处理自定义AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details }),
      requestId
    })
  }

  // 处理Prisma错误
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: '数据已存在',
      code: 'DUPLICATE_ENTRY',
      requestId
    })
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: '记录不存在',
      code: 'RECORD_NOT_FOUND',
      requestId
    })
  }

  // 处理Express/JSON解析错误
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: '无效的JSON格式',
      code: 'INVALID_JSON',
      requestId
    })
  }

  // 默认：返回500内部错误
  const statusCode = err.status || 500
  const message = statusCode >= 500 ? '服务器内部错误' : (err.message || '请求处理失败')

  return res.status(statusCode).json({
    success: false,
    error: message,
    code: 'INTERNAL_ERROR',
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}
