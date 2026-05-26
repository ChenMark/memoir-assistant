import type { VercelRequest, VercelResponse } from '@vercel/node'
import { canSendSMS, generateSMSCode, storeSMSCode, sendSMS } from './_utils'

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
    const { phone } = req.body || {}

    // 验证手机号格式（中国大陆手机号）
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入有效的手机号码' })
    }

    // 检查发送频率
    const { allowed, waitSeconds } = canSendSMS(phone)
    if (!allowed) {
      return res.status(429).json({
        error: `发送过于频繁，请 ${waitSeconds} 秒后再试`,
        waitSeconds,
      })
    }

    // 生成验证码
    const code = generateSMSCode()

    // 存储验证码
    storeSMSCode(phone, code)

    // 发送短信（开发模式模拟发送）
    await sendSMS(phone, code)

    const isDev = process.env.NODE_ENV === 'development' || !process.env.SMS_API_KEY

    return res.status(200).json({
      message: '验证码已发送',
      // 开发模式返回验证码方便调试
      ...(isDev ? { code, hint: '开发模式：验证码为 123456' } : {}),
      expireIn: 300, // 5分钟
    })
  } catch (e: any) {
    console.error('[SendSMS] 错误:', e)
    return res.status(500).json({ error: e.message || '发送失败' })
  }
}
