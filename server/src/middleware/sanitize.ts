/**
 * 输入净化中间件 — 防止XSS和恶意输入
 */
import { Request, Response, NextFunction } from 'express'

/**
 * 递归净化字符串，移除潜在的XSS攻击代码
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str
  
  return str
    // 移除<script>标签
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    // 移除javascript:协议
    .replace(/javascript:/gi, '')
    // 移除onclick, onerror等事件处理器
    .replace(/\s+on\w+\s*=/gi, ' ')
    // 移除<iframe>
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    // 移除<object>, <embed>
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    // 移除eval(), alert()等危险函数调用
    .replace(/eval\s*\(/gi, '(')
    .replace(/alert\s*\(/gi, '(')
}

/**
 * 递归净化对象中的所有字符串
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj
  
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item))
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {}
    for (const key of Object.keys(obj)) {
      sanitized[key] = sanitizeObject(obj[key])
    }
    return sanitized
  }
  
  return obj
}

/**
 * 输入净化中间件
 * 净化 req.body, req.query, req.params 中的用户输入
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  try {
    // 净化 request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body)
    }
    
    // 净化 query parameters
    if (req.query && typeof req.query === 'object') {
      (req as any).query = sanitizeObject(req.query)
    }
    
    // 净化 route parameters
    if (req.params && typeof req.params === 'object') {
      (req as any).params = sanitizeObject(req.params)
    }
    
    next()
  } catch (err: any) {
    console.error('[sanitize] Error:', err.message)
    next()
  }
}
