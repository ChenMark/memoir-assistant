import type { VercelRequest, VercelResponse } from '@vercel/node'
import { findUserByPhone, createUserByPhone, verifySMSCode, generateToken, sanitizeUser } from './_utils'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { phone, code, username } = req.body || {}

    // 验证手机号
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入有效的手机号码' })
    }

    // 验证验证码
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: '请输入 6 位验证码' })
    }

    if (!verifySMSCode(phone, code)) {
      return res.status(401).json({ error: '验证码错误或已过期' })
    }

    // 查找或创建用户
    let user = await findUserByPhone(phone)
    const isNewUser = !user

    if (!user) {
      user = await createUserByPhone({
        phone,
        username: username || undefined,
      })
    }

    const token = generateToken(user)

    return res.status(200).json({
      message: isNewUser ? '注册并登录成功' : '登录成功',
      user: sanitizeUser(user),
      token,
      isNewUser,
    })
  } catch (e: any) {
    console.error('[PhoneLogin] 错误:', e)
    return res.status(500).json({ error: e.message || '服务器内部错误' })
  }
}
