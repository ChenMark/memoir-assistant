/**
 * 忆往昔 SDK — 认证工具
 * Node.js 环境：使用 node:crypto
 */

import * as crypto from 'node:crypto'
import type { User, JWTPayload } from '../types/index.js'

// ==================== 密码哈希 (PBKDF2-SHA512) ====================

/**
 * 密码哈希 — Node.js: PBKDF2-SHA512
 */
export function hashPassword(
  password: string,
  salt?: string
): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512')
    .toString('hex')
  return { hash, salt: actualSalt }
}

/**
 * 密码校验 — 恒定时间比较
 */
export function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): boolean {
  const { hash: computedHash } = hashPassword(password, salt)
  return crypto.timingSafeEqual(
    Buffer.from(storedHash, 'hex'),
    Buffer.from(computedHash, 'hex')
  )
}

// ==================== JWT ====================

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(data: string): string {
  let s = data.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64').toString('utf8')
}

const DEFAULT_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 天

/**
 * 生成 JWT Token
 */
export function generateToken(
  user: Pick<User, 'id' | 'username' | 'email'>,
  secret: string,
  expiryMs: number = DEFAULT_TOKEN_EXPIRY
): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Date.now()
  const payload: JWTPayload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    iat: now,
    exp: now + expiryMs,
  }
  const hb = base64UrlEncode(JSON.stringify(header))
  const pb = base64UrlEncode(JSON.stringify(payload))
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${hb}.${pb}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${hb}.${pb}.${sig}`
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string, secret: string): JWTPayload | null {
  try {
    const [hb, pb, sig] = token.split('.')
    if (!hb || !pb || !sig) return null
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${hb}.${pb}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
    if (sig !== expected) return null
    const payload: JWTPayload = JSON.parse(base64UrlDecode(pb))
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ==================== 短信验证码工具 ====================

/**
 * 生成6位短信验证码
 */
export function generateSMSCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ==================== 工具函数 ====================

/**
 * 生成随机 salt
 */
export function generateSalt(length = 32): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let salt = ''
  for (let i = 0; i < length; i++) {
    salt += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return salt
}

/**
 * 脱敏用户信息（去除密码字段）
 */
export function sanitizeUser(user: User): Omit<User, 'passwordHash' | 'salt'> {
  const { passwordHash, salt, ...safe } = user
  return safe
}
