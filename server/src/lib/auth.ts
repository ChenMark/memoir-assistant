/**
 * 认证工具库 — 密码哈希 / JWT / 短信验证码 / 用户 CRUD（Prisma）
 */
import crypto from 'node:crypto'
import { prisma } from './prisma.js'

// ============ 类型定义 ============
export interface User {
  id: string
  username: string
  email: string
  phone?: string
  phoneVerified?: boolean
  passwordHash: string
  salt: string
  createdAt: string
  updatedAt: string
  avatar?: string
  bio?: string
  wechatOpenId?: string
  wechatUnionId?: string
  wechatNickname?: string
  qqOpenId?: string
  qqNickname?: string
}

export interface JWTPayload {
  sub: string
  username: string
  email: string
  iat: number
  exp: number
}

interface SMSRecord {
  phone: string
  code: string
  expiresAt: number
  attempts: number
}

// ============ 密码哈希 ============
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex')
  return { hash, salt: actualSalt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashPassword(password, salt)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'))
}

// ============ 短信验证码 ============
const smsStore = new Map<string, SMSRecord>()
const SMS_COOLDOWN = 60 * 1000
const SMS_EXPIRY = 5 * 60 * 1000
const SMS_MAX_ATTEMPTS = 5

setInterval(() => {
  const now = Date.now()
  for (const [k, r] of smsStore) {
    if (r.expiresAt < now) smsStore.delete(k)
  }
}, 60 * 1000)

export function generateSMSCode(): string {
  if (!process.env.SMS_API_KEY) return '123456'
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function canSendSMS(phone: string): { allowed: boolean; waitSeconds: number } {
  const record = smsStore.get(phone)
  if (!record) return { allowed: true, waitSeconds: 0 }
  const elapsed = Date.now() - (record.expiresAt - SMS_EXPIRY)
  if (elapsed < SMS_COOLDOWN) {
    return { allowed: false, waitSeconds: Math.ceil((SMS_COOLDOWN - elapsed) / 1000) }
  }
  return { allowed: true, waitSeconds: 0 }
}

export function storeSMSCode(phone: string, code: string): void {
  smsStore.set(phone, { phone, code, expiresAt: Date.now() + SMS_EXPIRY, attempts: 0 })
}

export function verifySMSCode(phone: string, code: string): boolean {
  const record = smsStore.get(phone)
  if (!record) return false
  if (record.expiresAt < Date.now()) { smsStore.delete(phone); return false }
  if (record.attempts >= SMS_MAX_ATTEMPTS) { smsStore.delete(phone); return false }
  record.attempts++
  const valid = record.code === code
  if (valid) smsStore.delete(phone)
  return valid
}

export async function sendSMS(phone: string, code: string): Promise<boolean> {
  console.log(`[SMS] 验证码 ${code} → ${phone}`)
  if (process.env.SMS_API_KEY && process.env.SMS_API_URL) {
    console.log('[SMS] 生产环境短信接口待配置')
  }
  return true
}

// ============ JWT ============
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required but not set.')
  console.error('请在 .env 文件中配置 JWT_SECRET，然后重启服务。')
  process.exit(1)
}
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000

function b64urlEncode(data: string): string {
  return Buffer.from(data).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlDecode(data: string): string {
  let s = data.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64').toString('utf8')
}

export function generateToken(user: User): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Date.now()
  const payload: JWTPayload = { sub: user.id, username: user.username, email: user.email, iat: now, exp: now + TOKEN_EXPIRY }
  const hb = b64urlEncode(JSON.stringify(header))
  const pb = b64urlEncode(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', JWT_SECRET!).update(`${hb}.${pb}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${hb}.${pb}.${sig}`
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const [hb, pb, sig] = token.split('.')
    if (!hb || !pb || !sig) return null
    const expected = crypto.createHmac('sha256', JWT_SECRET!).update(`${hb}.${pb}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    if (sig !== expected) return null
    const payload: JWTPayload = JSON.parse(b64urlDecode(pb))
    if (payload.exp < Date.now()) return null
    return payload
  } catch { return null }
}

// ============ 用户存储（Prisma）============

function toUser(prismaUser: any): User {
  return {
    id: prismaUser.id,
    username: prismaUser.username,
    email: prismaUser.email,
    phone: prismaUser.phone || undefined,
    phoneVerified: prismaUser.phoneVerified || false,
    passwordHash: prismaUser.passwordHash,
    salt: prismaUser.salt,
    createdAt: prismaUser.createdAt.toISOString(),
    updatedAt: prismaUser.updatedAt.toISOString(),
    avatar: prismaUser.avatar || undefined,
    bio: prismaUser.bio || undefined,
    wechatOpenId: prismaUser.wechatOpenId || undefined,
    wechatUnionId: prismaUser.wechatUnionId || undefined,
    wechatNickname: prismaUser.wechatNickname || undefined,
    qqOpenId: prismaUser.qqOpenId || undefined,
    qqNickname: prismaUser.qqNickname || undefined,
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } })
  return user ? toUser(user) : null
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const user = await prisma.user.findFirst({ where: { username: username.toLowerCase() } })
  return user ? toUser(user) : null
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const user = await prisma.user.findFirst({ where: { phone } })
  return user ? toUser(user) : null
}

export async function findUserById(id: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { id } })
  return user ? toUser(user) : null
}

export async function findUserByWechatOpenId(openId: string): Promise<User | null> {
  const user = await prisma.user.findFirst({ where: { wechatOpenId: openId } })
  return user ? toUser(user) : null
}

export async function findUserByQQOpenId(openId: string): Promise<User | null> {
  const user = await prisma.user.findFirst({ where: { qqOpenId: openId } })
  return user ? toUser(user) : null
}

export async function createUser(data: {
  username: string; email: string; password: string; phone?: string; phoneVerified?: boolean
}): Promise<User> {
  const { hash, salt } = hashPassword(data.password)
  const user = await prisma.user.create({
    data: {
      username: data.username.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash: hash,
      salt,
      phone: data.phone,
      phoneVerified: data.phoneVerified || false,
    }
  })
  return toUser(user)
}

export async function createUserByPhone(data: { phone: string; username?: string }): Promise<User> {
  const autoUsername = data.username || `用户${data.phone.slice(-4)}`
  const autoEmail = `${data.phone}@phone.memoir.local`
  const { hash, salt } = hashPassword(crypto.randomBytes(16).toString('hex'))
  const user = await prisma.user.create({
    data: {
      username: autoUsername,
      email: autoEmail,
      passwordHash: hash,
      salt,
      phone: data.phone,
      phoneVerified: true,
    }
  })
  return toUser(user)
}

export async function getOrCreateWechatUser(info: {
  openId: string; unionId?: string; nickname: string; avatar?: string
}): Promise<User> {
  const existing = await findUserByWechatOpenId(info.openId)
  if (existing) return existing
  
  const autoEmail = `wx_${info.openId.slice(0, 12)}@wechat.memoir.local`
  const { hash, salt } = hashPassword(crypto.randomBytes(16).toString('hex'))
  const user = await prisma.user.create({
    data: {
      username: info.nickname || '微信用户',
      email: autoEmail,
      passwordHash: hash,
      salt,
      wechatOpenId: info.openId,
      wechatUnionId: info.unionId,
      wechatNickname: info.nickname,
      avatar: info.avatar,
    }
  })
  return toUser(user)
}

export async function getOrCreateQQUser(info: {
  openId: string; nickname: string; avatar?: string
}): Promise<User> {
  const existing = await findUserByQQOpenId(info.openId)
  if (existing) return existing
  
  const autoEmail = `qq_${info.openId.slice(0, 12)}@qq.memoir.local`
  const { hash, salt } = hashPassword(crypto.randomBytes(16).toString('hex'))
  const user = await prisma.user.create({
    data: {
      username: info.nickname || 'QQ用户',
      email: autoEmail,
      passwordHash: hash,
      salt,
      qqOpenId: info.openId,
      qqNickname: info.nickname,
      avatar: info.avatar,
    }
  })
  return toUser(user)
}

export async function updateUser(userId: string, updates: Partial<Pick<User,
  'username' | 'avatar' | 'bio' | 'passwordHash' | 'salt' |
  'phone' | 'phoneVerified' | 'wechatOpenId' | 'wechatUnionId' |
  'wechatNickname' | 'qqOpenId' | 'qqNickname'>
>): Promise<User | null> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.username !== undefined && { username: updates.username }),
        ...(updates.avatar !== undefined && { avatar: updates.avatar }),
        ...(updates.bio !== undefined && { bio: updates.bio }),
        ...(updates.passwordHash !== undefined && { passwordHash: updates.passwordHash }),
        ...(updates.salt !== undefined && { salt: updates.salt }),
        ...(updates.phone !== undefined && { phone: updates.phone }),
        ...(updates.phoneVerified !== undefined && { phoneVerified: updates.phoneVerified }),
        ...(updates.wechatOpenId !== undefined && { wechatOpenId: updates.wechatOpenId }),
        ...(updates.wechatUnionId !== undefined && { wechatUnionId: updates.wechatUnionId }),
        ...(updates.wechatNickname !== undefined && { wechatNickname: updates.wechatNickname }),
        ...(updates.qqOpenId !== undefined && { qqOpenId: updates.qqOpenId }),
        ...(updates.qqNickname !== undefined && { qqNickname: updates.qqNickname }),
      }
    })
    return toUser(user)
  } catch (err: any) {
    if (err.code === 'P2025') return null // Record not found
    throw err
  }
}

/** 修改密码 — 先验证旧密码，再更新 */
export async function changeUserPassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
  const user = await findUserById(userId)
  if (!user) return false
  if (!verifyPassword(oldPassword, user.passwordHash, user.salt)) return false
  const { hash, salt } = hashPassword(newPassword)
  await updateUser(userId, { passwordHash: hash, salt })
  return true
}

/** 删除用户（需先验证密码） */
export async function deleteUser(userId: string, password: string): Promise<boolean> {
  const user = await findUserById(userId)
  if (!user) return false
  if (!verifyPassword(password, user.passwordHash, user.salt)) return false
  await prisma.user.delete({ where: { id: userId } })
  return true
}

/** 脱敏：去除密码字段 */
export function sanitizeUser(user: User): Omit<User, 'passwordHash' | 'salt'> {
  const { passwordHash, salt, ...safe } = user
  return safe
}
