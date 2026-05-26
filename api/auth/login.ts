import type { VercelRequest, VercelResponse } from '@vercel/node'
import { findUserByEmail, findUserByPhone, verifyPassword, generateToken, sanitizeUser } from './_utils'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 方法' })
  }

  try {
    const { email, phone, password } = req.body || {}

    // 支持邮箱或手机号登录
    const account = email || phone
    if (!account || !password) {
      return res.status(400).json({ error: '请输入账号（邮箱/手机号）和密码' })
    }

    // 查找用户：优先邮箱，其次手机号
    let user = null
    if (account.includes('@')) {
      user = await findUserByEmail(account)
    } else if (/^1[3-9]\d{9}$/.test(account)) {
      user = await findUserByPhone(account)
    } else {
      // 尝试作为邮箱查找
      user = await findUserByEmail(account)
    }

    if (!user) {
      return res.status(401).json({ error: '账号或密码错误' })
    }

    // 验证密码
    if (!verifyPassword(password, user.passwordHash, user.salt)) {
      return res.status(401).json({ error: '账号或密码错误' })
    }

    // 生成 token
    const token = generateToken(user)

    return res.status(200).json({
      message: '登录成功',
      user: sanitizeUser(user),
      token,
    })
  } catch (e: any) {
    console.error('[Login] 错误:', e)
    return res.status(500).json({ error: e.message || '服务器内部错误' })
  }
}
