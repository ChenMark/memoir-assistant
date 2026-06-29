import crypto from 'crypto'
import jwt from 'jsonwebtoken'

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
  // 第三方绑定
  wechatOpenId?: string
  wechatUnionId?: string
  wechatNickname?: string
  qqOpenId?: string
  qqNickname?: string
}

export interface UsersDB {
  users: User[]
  version: number
}

export interface JWTPayload {
  sub: string
  username: string
  email: string
  iat: number
  exp: number
}

export interface SMSRecord {
  phone: string
  code: string
  expiresAt: number
  attempts: number
}

// ============ 安全：JWT 密钥强制环境变量 ============
// 修复 1: 移除硬编码默认密钥，生产环境必须设置 JWT_SECRET
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      throw new Error('[Security] JWT_SECRET 环境变量未设置，无法在生产环境运行')
    }
    // 仅开发环境允许使用本地密钥
    console.warn('[Security] 警告：JWT_SECRET 未设置，使用开发环境默认密钥')
    return 'memoir-jwt-secret-dev-only-' + (process.env.VERCEL_ENV || 'local')
  }
  // 强制最低密钥长度要求
  if (secret.length < 32) {
    throw new Error('[Security] JWT_SECRET 长度不足，至少需要 32 个字符')
  }
  return secret
}

// ============ 密码哈希（增强）============
// 修复 3: PBKDF2 轮次从 10000 提升到 310000（OWASP 2025 推荐）
const PBKDF2_ITERATIONS = 310000
const PBKDF2_KEYLEN = 64
const PBKDF2_DIGEST = 'sha512'
const SALT_LENGTH = 16

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(SALT_LENGTH).toString('hex')
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex')
  return { hash, salt: actualSalt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashPassword(password, salt)
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(computedHash, 'hex')
  )
}

// ============ 短信验证码（支持 OSS 持久化）============
// 修复 5: 增加 OSS 持久化作为冷启动降级方案
const smsStore: Map<string, SMSRecord> = new Map()
const SMS_COOLDOWN = 60 * 1000          // 60秒冷却
const SMS_EXPIRY = 5 * 60 * 1000         // 5分钟有效期
const SMS_MAX_ATTEMPTS = 5
const SMS_OSS_KEY = 'memoir/users/sms-codes.json'

// 定期清理过期验证码
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of smsStore) {
    if (record.expiresAt < now) smsStore.delete(key)
  }
}, 60 * 1000)

// OSS 持久化：保存验证码到 OSS（后台异步，不阻塞主流程）
async function persistSMSCodes(): Promise<void> {
  try {
    const serializable: Record<string, SMSRecord> = {}
    const now = Date.now()
    for (const [key, record] of smsStore) {
      if (record.expiresAt > now) {
        serializable[key] = record
      }
    }
    const baseUrl = await getBaseUrl()
    const signRes = await fetch(`${baseUrl}/api/oss/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: SMS_OSS_KEY,
        contentType: 'application/json',
        method: 'PUT',
      }),
    })
    if (!signRes.ok) return
    const { url } = await signRes.json()
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializable),
    })
  } catch {
    // 持久化失败不影响主流程
  }
}

// OSS 持久化：冷启动时恢复验证码
async function restoreSMSCodes(): Promise<void> {
  try {
    const baseUrl = await getBaseUrl()
    const signRes = await fetch(`${baseUrl}/api/oss/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: SMS_OSS_KEY }),
    })
    if (!signRes.ok) return
    const { url } = await signRes.json()
    const downloadRes = await fetch(url)
    if (!downloadRes.ok) return
    const data = await downloadRes.json()
    const now = Date.now()
    for (const [key, record] of Object.entries(data)) {
      const smsRecord = record as SMSRecord
      if (smsRecord.expiresAt > now) {
        smsStore.set(key, smsRecord)
      }
    }
    console.log(`[SMS] 冷启动恢复: 从 OSS 恢复了 ${smsStore.size} 条有效验证码`)
  } catch {
    // 恢复失败不阻塞
  }
}

// 模块加载时自动恢复
restoreSMSCodes()

export function generateSMSCode(): string {
  if (process.env.NODE_ENV === 'development' || !process.env.SMS_API_KEY) {
    return '123456'
  }
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
  smsStore.set(phone, {
    phone,
    code,
    expiresAt: Date.now() + SMS_EXPIRY,
    attempts: 0,
  })
  // 异步持久化到 OSS（不阻塞）
  persistSMSCodes().catch(() => {})
}

export function verifySMSCode(phone: string, code: string): boolean {
  const record = smsStore.get(phone)
  if (!record) return false
  if (record.expiresAt < Date.now()) {
    smsStore.delete(phone)
    return false
  }
  if (record.attempts >= SMS_MAX_ATTEMPTS) {
    smsStore.delete(phone)
    return false
  }
  record.attempts++
  const valid = record.code === code
  if (valid) {
    smsStore.delete(phone)
    // 验证成功后异步清理 OSS 中的记录
    persistSMSCodes().catch(() => {})
  }
  return valid
}

/**
 * 模拟发送短信（开发/演示模式）
 * 生产环境需接入真实短信服务商
 */
export async function sendSMS(phone: string, code: string): Promise<boolean> {
  console.log(`[SMS 模拟] 发送验证码 ${code} 到手机号 ${phone}`)

  if (process.env.SMS_API_KEY && process.env.SMS_API_URL) {
    // TODO: 接入真实短信 API（阿里云短信/腾讯云短信等）
    console.log('[SMS] 生产环境短信接口待配置')
  }

  return true
}

// ============ JWT 令牌（使用标准库）============
// 修复 2: 使用 jsonwebtoken 标准库替代手工实现
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 天（秒）

export function generateToken(user: User): string {
  const secret = getJWTSecret()
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    username: user.username,
    email: user.email,
  }

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: TOKEN_EXPIRY_SECONDS,
  })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = getJWTSecret()
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as JWTPayload
    return decoded
  } catch (err: unknown) {
    // 记录验证失败原因用于审计（不暴露敏感信息给客户端）
    if (err instanceof jwt.TokenExpiredError) {
      console.log('[JWT] Token 过期')
    } else if (err instanceof jwt.JsonWebTokenError) {
      console.log('[JWT] Token 无效:', err.message)
    }
    return null
  }
}

// ============ 用户存储（通过 OSS，带乐观锁并发控制）============
const USERS_KEY = 'memoir/users/users.json'

// ============ 内存缓存（Vercel 冷启动之间有效）============
let cachedUsers: UsersDB | null = null
let cacheTime = 0
const CACHE_TTL = 30 * 1000 // 30秒

// 修复 4: 并发控制 - 最大重试次数
const MAX_RETRY = 3
const RETRY_DELAY_MS = 200

class UserStorageConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserStorageConflictError'
  }
}

async function getBaseUrl(): Promise<string> {
  const url = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  return url
}

/**
 * 直接从 OSS 加载用户数据（绕过缓存）
 * 用于乐观锁版本号校验
 */
async function loadUsersDirectFromOSS(): Promise<UsersDB> {
  try {
    const baseUrl = await getBaseUrl()
    const signRes = await fetch(`${baseUrl}/api/oss/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: USERS_KEY }),
    })

    if (!signRes.ok) {
      return { users: [], version: 1 }
    }

    const { url } = await signRes.json()
    const downloadRes = await fetch(url)
    if (!downloadRes.ok) {
      return { users: [], version: 1 }
    }

    return await downloadRes.json()
  } catch {
    return { users: [], version: 1 }
  }
}

export async function loadUsers(forceRefresh = false): Promise<UsersDB> {
  if (!forceRefresh && cachedUsers && (Date.now() - cacheTime) < CACHE_TTL) {
    return cachedUsers
  }

  try {
    const db = await loadUsersDirectFromOSS()
    cachedUsers = db
    cacheTime = Date.now()
    return db
  } catch {
    const empty: UsersDB = { users: [], version: 1 }
    cachedUsers = empty
    cacheTime = Date.now()
    return empty
  }
}

/**
 * 保存用户数据（带乐观锁并发控制）
 * 修复 4: 检查版本号，防止并发覆盖
 */
export async function saveUsers(db: UsersDB): Promise<void> {
  // 步骤 1: 从 OSS 重新加载，检查版本号
  const current = await loadUsersDirectFromOSS()

  if (current.version !== db.version) {
    throw new UserStorageConflictError(
      `版本冲突: 本地版本 ${db.version}，远程版本 ${current.version}`
    )
  }

  // 步骤 2: 递增版本号并保存
  const newVersion = current.version + 1
  const dbToSave: UsersDB = {
    users: db.users,
    version: newVersion,
  }

  // 步骤 3: 更新缓存
  cachedUsers = dbToSave
  cacheTime = Date.now()

  // 步骤 4: 写入 OSS
  try {
    const baseUrl = await getBaseUrl()
    const signRes = await fetch(`${baseUrl}/api/oss/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: USERS_KEY,
        contentType: 'application/json',
        method: 'PUT',
      }),
    })

    if (!signRes.ok) throw new Error(`获取上传签名失败: ${signRes.status}`)
    const { url } = await signRes.json()

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbToSave, null, 2),
    })

    if (!uploadRes.ok) throw new Error(`上传用户数据失败: ${uploadRes.status}`)
  } catch (e) {
    // 保存失败时清除缓存，下次请求会重新加载
    cachedUsers = null
    cacheTime = 0
    console.error('[Auth] 保存用户数据失败:', e)
    throw new Error('用户数据保存失败，请稍后重试')
  }
}

/**
 * 带重试的乐观锁保存
 * 解决并发编辑冲突：重新加载 → 重新应用修改 → 再次保存
 */
async function saveUsersWithRetry(
  modifyFn: (db: UsersDB) => void
): Promise<UsersDB> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    try {
      // 强制从 OSS 重新加载（绕过缓存）
      const db = await loadUsersDirectFromOSS()
      cachedUsers = db
      cacheTime = Date.now()

      // 应用修改
      modifyFn(db)

      // 保存（带版本检查）
      await saveUsers(db)

      return db
    } catch (err) {
      lastError = err as Error

      // 只有版本冲突才重试
      if (!(err instanceof UserStorageConflictError)) {
        throw err
      }

      console.warn(
        `[Auth] 用户数据保存冲突 (尝试 ${attempt + 1}/${MAX_RETRY})，重试中...`
      )

      // 指数退避 + 随机抖动
      if (attempt < MAX_RETRY - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 100
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw new Error(
    `用户数据保存失败（重试 ${MAX_RETRY} 次后仍冲突）: ${lastError?.message}`
  )
}

// ============ 用户查询 ============

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await loadUsers()
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await loadUsers()
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const db = await loadUsers()
  return db.users.find(u => u.phone === phone) || null
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await loadUsers()
  return db.users.find(u => u.id === id) || null
}

export async function findUserByWechatOpenId(openId: string): Promise<User | null> {
  const db = await loadUsers()
  return db.users.find(u => u.wechatOpenId === openId) || null
}

export async function findUserByQQOpenId(openId: string): Promise<User | null> {
  const db = await loadUsers()
  return db.users.find(u => u.qqOpenId === openId) || null
}

// ============ 用户创建 ============

export async function createUser(userData: {
  username: string
  email: string
  password: string
  phone?: string
  phoneVerified?: boolean
}): Promise<User> {
  const { hash, salt } = hashPassword(userData.password)
  const now = new Date().toISOString()

  const user: User = {
    id: `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
    username: userData.username.trim(),
    email: userData.email.toLowerCase().trim(),
    phone: userData.phone,
    phoneVerified: userData.phoneVerified || false,
    passwordHash: hash,
    salt,
    createdAt: now,
    updatedAt: now,
  }

  // 使用带重试的乐观锁保存
  let savedUser: User = user
  await saveUsersWithRetry((db) => {
    db.users.push(user)
    savedUser = user
  })

  return savedUser
}

/**
 * 通过手机号注册（无需密码，验证码已验证）
 */
export async function createUserByPhone(userData: {
  phone: string
  username?: string
}): Promise<User> {
  const autoUsername = userData.username || `用户${userData.phone.slice(-4)}`
  const autoEmail = `${userData.phone}@phone.memoir.local`
  const randomPwd = crypto.randomBytes(16).toString('hex')
  const { hash, salt } = hashPassword(randomPwd)
  const now = new Date().toISOString()

  const user: User = {
    id: `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
    username: autoUsername,
    email: autoEmail,
    phone: userData.phone,
    phoneVerified: true,
    passwordHash: hash,
    salt,
    createdAt: now,
    updatedAt: now,
  }

  let savedUser: User = user
  await saveUsersWithRetry((db) => {
    db.users.push(user)
    savedUser = user
  })

  return savedUser
}

/**
 * 通过微信信息创建/查找用户
 */
export async function getOrCreateWechatUser(wechatInfo: {
  openId: string
  unionId?: string
  nickname: string
  avatar?: string
}): Promise<User> {
  const existing = await findUserByWechatOpenId(wechatInfo.openId)
  if (existing) return existing

  const autoEmail = `wx_${wechatInfo.openId.slice(0, 12)}@wechat.memoir.local`
  const randomPwd = crypto.randomBytes(16).toString('hex')
  const { hash, salt } = hashPassword(randomPwd)
  const now = new Date().toISOString()

  const user: User = {
    id: `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
    username: wechatInfo.nickname || '微信用户',
    email: autoEmail,
    passwordHash: hash,
    salt,
    wechatOpenId: wechatInfo.openId,
    wechatUnionId: wechatInfo.unionId,
    wechatNickname: wechatInfo.nickname,
    avatar: wechatInfo.avatar,
    createdAt: now,
    updatedAt: now,
  }

  // 防止竞态：重新检查一次是否已被并发创建
  const recheck = await findUserByWechatOpenId(wechatInfo.openId)
  if (recheck) return recheck

  let savedUser: User = user
  await saveUsersWithRetry((db) => {
    // 再次检查（在锁内）
    const dup = db.users.find(u => u.wechatOpenId === wechatInfo.openId)
    if (dup) {
      savedUser = dup
      return
    }
    db.users.push(user)
    savedUser = user
  })

  return savedUser
}

/**
 * 通过 QQ 信息创建/查找用户
 */
export async function getOrCreateQQUser(qqInfo: {
  openId: string
  nickname: string
  avatar?: string
}): Promise<User> {
  const existing = await findUserByQQOpenId(qqInfo.openId)
  if (existing) return existing

  const autoEmail = `qq_${qqInfo.openId.slice(0, 12)}@qq.memoir.local`
  const randomPwd = crypto.randomBytes(16).toString('hex')
  const { hash, salt } = hashPassword(randomPwd)
  const now = new Date().toISOString()

  const user: User = {
    id: `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
    username: qqInfo.nickname || 'QQ用户',
    email: autoEmail,
    passwordHash: hash,
    salt,
    qqOpenId: qqInfo.openId,
    qqNickname: qqInfo.nickname,
    avatar: qqInfo.avatar,
    createdAt: now,
    updatedAt: now,
  }

  const recheck = await findUserByQQOpenId(qqInfo.openId)
  if (recheck) return recheck

  let savedUser: User = user
  await saveUsersWithRetry((db) => {
    const dup = db.users.find(u => u.qqOpenId === qqInfo.openId)
    if (dup) {
      savedUser = dup
      return
    }
    db.users.push(user)
    savedUser = user
  })

  return savedUser
}

// ============ 用户更新 ============

export async function updateUser(
  userId: string,
  updates: Partial<Pick<User, 'username' | 'avatar' | 'bio' | 'passwordHash' | 'salt' | 'phone' | 'phoneVerified' | 'wechatOpenId' | 'wechatUnionId' | 'wechatNickname' | 'qqOpenId' | 'qqNickname'>>
): Promise<User | null> {
  let updatedUser: User | null = null

  await saveUsersWithRetry((db) => {
    const index = db.users.findIndex(u => u.id === userId)
    if (index === -1) {
      updatedUser = null
      return
    }

    db.users[index] = {
      ...db.users[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    updatedUser = db.users[index]
  })

  return updatedUser
}

// ============ 工具函数 ============

// 明文密码脱敏
export function sanitizeUser(user: User): Omit<User, 'passwordHash' | 'salt'> {
  const { passwordHash, salt, ...safe } = user
  return safe
}
