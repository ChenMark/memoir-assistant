import type { VercelRequest, VercelResponse } from '@vercel/node'
import { findUserByEmail, findUserByUsername, createUser, generateToken, sanitizeUser } from './_utils'

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
    const { username, email, password, phone } = req.body || {}

    // 验证输入
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码为必填项' })
    }

    if (typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ error: '用户名至少 2 个字符' })
    }

    if (username.trim().length > 30) {
      return res.status(400).json({ error: '用户名最多 30 个字符' })
    }

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
      return res.status(400).json({ error: '用户名只能包含字母、数字、下划线和中文' })
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 个字符' })
    }

    // 检查邮箱是否已注册
    const existingEmail = await findUserByEmail(email)
    if (existingEmail) {
      return res.status(409).json({ error: '该邮箱已被注册' })
    }

    // 检查用户名是否已存在
    const existingUsername = await findUserByUsername(username)
    if (existingUsername) {
      return res.status(409).json({ error: '该用户名已被使用' })
    }

    // 验证手机号（可选）
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' })
    }

    // 创建用户
    const user = await createUser({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone || undefined,
    })

    // 生成 token
    const token = generateToken(user)

    return res.status(201).json({
      message: '注册成功',
      user: sanitizeUser(user),
      token,
    })
  } catch (e: any) {
    console.error('[Register] 错误:', e)
    return res.status(500).json({ error: e.message || '服务器内部错误' })
  }
}
