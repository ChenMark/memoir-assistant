import crypto from 'crypto'

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

// ============ 密码哈希 ============
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512')
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

// ============ 短信验证码 ============
const smsStore: Map<string, SMSRecord> = new Map()
const SMS_COOLDOWN = 60 * 1000 // 60秒冷却
const SMS_EXPIRY = 5 * 60 * 1000  // 5分钟有效期
const SMS_MAX_ATTEMPTS = 5

// 定期清理过期验证码
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of smsStore) {
    if (record.expiresAt < now) smsStore.delete(key)
  }
}, 60 * 1000)

export function generateSMSCode(): string {
  if (process.env.NODE_ENV === 'development' || !process.env.SMS_API_KEY) {
    // 开发环境固定验证码 123456
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
  if (valid) smsStore.delete(phone)
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
    // const res = await fetch(process.env.SMS_API_URL, { ... })
    // return res.ok
    console.log('[SMS] 生产环境短信接口待配置')
  }

  // 开发/演示模式：始终返回成功
  return true
}

// ============ JWT ============
const JWT_SECRET = process.env.JWT_SECRET || 'memoir-jwt-secret-change-in-production'
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 天

function base64urlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64urlDecode(data: string): string {
  let str = data.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return Buffer.from(str, 'base64').toString('utf8')
}

export function generateToken(user: User): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Date.now()
  const payload: JWTPayload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    iat: now,
    exp: now + TOKEN_EXPIRY,
  }

  const headerB64 = base64urlEncode(JSON.stringify(header))
  const payloadB64 = base64urlEncode(JSON.stringify(payload))
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${headerB64}.${payloadB64}.${signature}`
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts

    // 验证签名
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

    if (signatureB64 !== expectedSig) return null

    // 解析 payload
    const payload: JWTPayload = JSON.parse(base64urlDecode(payloadB64))

    // 验证过期时间
    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}

// ============ 用户存储（通过 OSS）============
const USERS_KEY = 'memoir/users/users.json'

// ============ 内存缓存（Vercel 冷启动之间有效）============
let cachedUsers: UsersDB | null = null
let cacheTime = 0
const CACHE_TTL = 30 * 1000 // 30秒

async function getBaseUrl(): Promise<string> {
  const url = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  return url
}

export async function loadUsers(forceRefresh = false): Promise<UsersDB> {
  if (!forceRefresh && cachedUsers && (Date.now() - cacheTime) < CACHE_TTL) {
    return cachedUsers
  }

  try {
    const baseUrl = await getBaseUrl()
    const signRes = await fetch(`${baseUrl}/api/oss/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: USERS_KEY }),
    })

    if (!signRes.ok) {
      const empty: UsersDB = { users: [], version: 1 }
      cachedUsers = empty
      cacheTime = Date.now()
      return empty
    }

    const { url } = await signRes.json()
    const downloadRes = await fetch(url)
    if (!downloadRes.ok) {
      const empty: UsersDB = { users: [], version: 1 }
      cachedUsers = empty
      cacheTime = Date.now()
      return empty
    }

    const db: UsersDB = await downloadRes.json()
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

export async function saveUsers(db: UsersDB): Promise<void> {
  cachedUsers = db
  cacheTime = Date.now()

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
      body: JSON.stringify(db, null, 2),
    })

    if (!uploadRes.ok) throw new Error(`上传用户数据失败: ${uploadRes.status}`)
  } catch (e) {
    console.error('[Auth] 保存用户数据失败:', e)
    throw new Error('用户数据保存失败，请稍后重试')
  }
}

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

export async function createUser(userData: {
  username: string
  email: string
  password: string
  phone?: string
  phoneVerified?: boolean
}): Promise<User> {
  const db = await loadUsers(true)

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

  db.users.push(user)
  await saveUsers(db)

  return user
}

/**
 * 通过手机号注册（无需密码，验证码已验证）
 */
export async function createUserByPhone(userData: {
  phone: string
  username?: string
}): Promise<User> {
  const db = await loadUsers(true)

  const autoUsername = userData.username || `用户${userData.phone.slice(-4)}`
  const autoEmail = `${userData.phone}@phone.memoir.local`
  // 手机号注册自动生成随机密码
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

  db.users.push(user)
  await saveUsers(db)

  return user
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

  const db = await loadUsers(true)

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

  db.users.push(user)
  await saveUsers(db)
  return user
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

  const db = await loadUsers(true)

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

  db.users.push(user)
  await saveUsers(db)
  return user
}

export async function updateUser(
  userId: string,
  updates: Partial<Pick<User, 'username' | 'avatar' | 'bio' | 'passwordHash' | 'salt' | 'phone' | 'phoneVerified' | 'wechatOpenId' | 'wechatUnionId' | 'wechatNickname' | 'qqOpenId' | 'qqNickname'>>
): Promise<User | null> {
  const db = await loadUsers(true)
  const index = db.users.findIndex(u => u.id === userId)
  if (index === -1) return null

  db.users[index] = {
    ...db.users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await saveUsers(db)
  return db.users[index]
}

// 明文密码脱敏
export function sanitizeUser(user: User): Omit<User, 'passwordHash' | 'salt'> {
  const { passwordHash, salt, ...safe } = user
  return safe
}
