/**
 * 认证路由 — 注册 / 登录 / Token 验证 / 短信 / 第三方登录
 */
import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import {
  findUserByEmail, findUserByUsername, findUserByPhone, findUserById,
  createUser, createUserByPhone, getOrCreateWechatUser, getOrCreateQQUser,
  verifyPassword, generateToken, verifyToken, sanitizeUser, updateUser,
  generateSMSCode, canSendSMS, storeSMSCode, verifySMSCode, sendSMS,
  changeUserPassword, deleteUser,
} from '../lib/auth.js'
import {
  registerSchema, loginSchema, sendSMSSchema, phoneLoginSchema, updateUserSchema,
} from '../validators/auth.validator.js'

const router = Router()

// ============ 登录限流：15分钟内最多20次尝试 ============
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: '登录尝试次数过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ============ 中间件：Bearer Token 验证 ============
export function authMiddleware(req: Request, res: Response, next: Function) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' })
  }
  const token = auth.slice(7)
  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
  (req as any).userId = payload.sub
  ;(req as any).userEmail = payload.email
  next()
}

// ============ POST /auth/register ============
router.post('/register', async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = registerSchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e: any) => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const { username, email, password, phone } = validationResult.data

    const [emailExists, nameExists] = await Promise.all([
      findUserByEmail(email),
      findUserByUsername(username),
    ])
    if (emailExists) return res.status(409).json({ error: '该邮箱已被注册' })
    if (nameExists) return res.status(409).json({ error: '该用户名已被使用' })

    const user = await createUser({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone || undefined,
    })

    const token = generateToken(user)
    res.status(201).json({ user: sanitizeUser(user), token })
  } catch (err: any) {
    console.error('[auth/register]', err.message)
    res.status(500).json({ error: '注册失败，请稍后重试' })
  }
})

// ============ POST /auth/login ============
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = loginSchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e: any) => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const { account, password } = validationResult.data
    const loginAccount = account
    
    let user = await findUserByEmail(loginAccount)
    if (!user) user = await findUserByUsername(loginAccount)
    if (!user) user = await findUserByPhone(loginAccount)

    if (!user) return res.status(401).json({ error: '账号或密码错误' })
    if (!verifyPassword(password, user.passwordHash, user.salt)) {
      return res.status(401).json({ error: '账号或密码错误' })
    }

    const token = generateToken(user)
    res.json({ user: sanitizeUser(user), token })
  } catch (err: any) {
    console.error('[auth/login]', err.message)
    res.status(500).json({ error: '登录失败，请稍后重试' })
  }
})

// ============ GET /auth/me ============
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId
    const user = await findUserById(userId)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: sanitizeUser(user) })
  } catch (err: any) {
    console.error('[auth/me]', err.message)
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

// ============ PUT /auth/me — 更新用户信息 ============
router.put('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = updateUserSchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e: any) => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const userId = (req as any).userId
    const { username, bio } = validationResult.data
    const updates: any = {}
    if (username !== undefined) {
      updates.username = username.trim()
    }
    if (bio !== undefined) updates.bio = bio
    const user = await updateUser(userId, updates)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: sanitizeUser(user) })
  } catch (err: any) {
    console.error('[auth/me PUT]', err.message)
    res.status(500).json({ error: '更新用户信息失败' })
  }
})

// ============ POST /auth/send-sms ============
router.post('/send-sms', async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = sendSMSSchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e: any) => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const { phone } = validationResult.data
    const { allowed, waitSeconds } = canSendSMS(phone)
    if (!allowed) {
      return res.status(429).json({ error: `请 ${waitSeconds} 秒后再试`, waitSeconds })
    }
    const code = generateSMSCode()
    storeSMSCode(phone, code)
    await sendSMS(phone, code)
    res.json({ success: true, message: '验证码已发送' })
  } catch (err: any) {
    console.error('[auth/send-sms]', err.message)
    res.status(500).json({ error: '发送验证码失败' })
  }
})

// ============ POST /auth/phone-login ============
router.post('/phone-login', async (req: Request, res: Response) => {
  try {
    // 使用 Zod 验证输入
    const validationResult = phoneLoginSchema.safeParse(req.body)
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e: any) => e.message)
      return res.status(400).json({ error: errors[0] || '输入验证失败' })
    }
    
    const { phone, code } = validationResult.data
    
    if (!verifySMSCode(phone, code)) {
      return res.status(400).json({ error: '验证码错误或已过期' })
    }

    let user = await findUserByPhone(phone)
    if (!user) {
      user = await createUserByPhone({ phone })
    }
    const token = generateToken(user)
    res.json({ user: sanitizeUser(user), token })
  } catch (err: any) {
    console.error('[auth/phone-login]', err.message)
    res.status(500).json({ error: '手机号登录失败' })
  }
})

// ============ GET /auth/wechat — 微信 OAuth ============
router.get('/wechat', async (req: Request, res: Response) => {
  try {
    const appId = process.env.WECHAT_APP_ID
    const redirectUri = process.env.WECHAT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/wechat/callback`

    if (!appId) {
      // 演示模式
      const demoUser = await getOrCreateWechatUser({
        openId: 'demo_wx_openid_' + Date.now(),
        nickname: '微信演示用户',
      })
      const token = generateToken(demoUser)
      return res.json({ user: sanitizeUser(demoUser), token, demo: true })
    }

    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_userinfo&state=${Date.now()}#wechat_redirect`
    res.redirect(authUrl)
  } catch (err: any) {
    console.error('[auth/wechat]', err.message)
    res.status(500).json({ error: '微信登录失败' })
  }
})

// ============ GET /auth/wechat-auth — 前端微信登录入口 ============
router.get('/wechat-auth', async (req: Request, res: Response) => {
  try {
    const { code } = req.query
    // 如果带 code，说明是 OAuth 回调
    if (code) {
      return handleWechatCallback(req, res)
    }

    const appId = process.env.WECHAT_APP_ID
    const redirectUri = process.env.WECHAT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/wechat-auth`

    if (!appId) {
      // 演示模式：返回配置让前端直接调用模拟接口
      return res.json({ demo: true, demoAuthUrl: '/auth/wechat' })
    }

    const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_userinfo&state=${Date.now()}#wechat_redirect`
    res.json({ authUrl })
  } catch (err: any) {
    console.error('[auth/wechat-auth]', err.message)
    res.status(500).json({ error: '微信登录失败' })
  }
})

// ============ GET /auth/wechat/callback — 微信回调 ============
router.get('/wechat/callback', handleWechatCallback)

// ============ 微信 OAuth 回调处理（提取为公共函数）============
async function handleWechatCallback(req: Request, res: Response) {
  try {
    const { code } = req.query
    if (!code) return res.status(400).json({ error: '缺少授权码' })

    // 用 code 换取 access_token（需真实 AppId/Secret）
    const appId = process.env.WECHAT_APP_ID
    const appSecret = process.env.WECHAT_APP_SECRET
    if (!appId || !appSecret) {
      return res.status(500).json({ error: '微信未配置' })
    }
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`
    )
    const tokenData = await tokenRes.json() as any
    if (tokenData.errcode) return res.status(400).json({ error: '微信授权失败' })

    // 获取用户信息
    const infoRes = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}&lang=zh_CN`
    )
    const info = await infoRes.json() as any

    const user = await getOrCreateWechatUser({
      openId: info.openid,
      unionId: info.unionid,
      nickname: info.nickname || '微信用户',
      avatar: info.headimgurl,
    })
    const token = generateToken(user)
    res.json({ user: sanitizeUser(user), token })
  } catch (err: any) {
    console.error('[wechat callback]', err.message)
    res.status(500).json({ error: '微信登录失败' })
  }
}

// ============ QQ OAuth 回调处理（提取为公共函数）============
async function handleQQCallback(req: Request, res: Response) {
  try {
    const { code } = req.query
    if (!code) return res.status(400).json({ error: '缺少授权码' })

    const appId = process.env.QQ_APP_ID
    const appKey = process.env.QQ_APP_KEY
    if (!appId || !appKey) return res.status(500).json({ error: 'QQ未配置' })

    const redirectUri = process.env.QQ_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/qq/callback`
    const tokenRes = await fetch(
      `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${appId}&client_secret=${appKey}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}&fmt=json`
    )
    const tokenData = await tokenRes.json() as any
    if (tokenData.error) return res.status(400).json({ error: 'QQ授权失败' })

    // 获取 openId
    const openIdRes = await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${tokenData.access_token}&fmt=json`)
    const openIdData = await openIdRes.json() as any
    if (openIdData.error) return res.status(400).json({ error: '获取QQ OpenID失败' })

    // 获取用户信息
    const infoRes = await fetch(
      `https://graph.qq.com/user/get_user_info?access_token=${tokenData.access_token}&oauth_consumer_key=${appId}&openid=${openIdData.openid}`
    )
    const info = await infoRes.json() as any

    const user = await getOrCreateQQUser({
      openId: openIdData.openid,
      nickname: info.nickname || 'QQ用户',
      avatar: info.figureurl_qq_2 || info.figureurl_qq_1,
    })
    const token = generateToken(user)
    res.json({ user: sanitizeUser(user), token })
  } catch (err: any) {
    console.error('[qq callback]', err.message)
    res.status(500).json({ error: 'QQ登录失败' })
  }
}

// ============ GET /auth/qq — QQ OAuth ============
router.get('/qq', async (req: Request, res: Response) => {
  try {
    const appId = process.env.QQ_APP_ID
    const redirectUri = process.env.QQ_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/qq/callback`

    if (!appId) {
      // 演示模式
      const demoUser = await getOrCreateQQUser({
        openId: 'demo_qq_openid_' + Date.now(),
        nickname: 'QQ演示用户',
      })
      const token = generateToken(demoUser)
      return res.json({ user: sanitizeUser(demoUser), token, demo: true })
    }

    const authUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${Date.now()}`
    res.redirect(authUrl)
  } catch (err: any) {
    console.error('[auth/qq]', err.message)
    res.status(500).json({ error: 'QQ登录失败' })
  }
})

// ============ GET /auth/qq-auth — 前端 QQ 登录入口 ============
router.get('/qq-auth', async (req: Request, res: Response) => {
  try {
    const { code } = req.query
    // 如果带 code，说明是 OAuth 回调
    if (code) {
      return handleQQCallback(req, res)
    }

    const appId = process.env.QQ_APP_ID
    const redirectUri = process.env.QQ_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/qq-auth`

    if (!appId) {
      // 演示模式
      return res.json({ demo: true, demoAuthUrl: '/auth/qq' })
    }

    const authUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${Date.now()}`
    res.json({ authUrl })
  } catch (err: any) {
    console.error('[auth/qq-auth]', err.message)
    res.status(500).json({ error: 'QQ登录失败' })
  }
})

// ============ GET /auth/qq/callback — QQ 回调 ============
router.get('/qq/callback', handleQQCallback)

// ============ POST /auth/change-password — 修改密码 ============
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { old_password, new_password } = req.body
    if (!old_password || !new_password) {
      return res.status(400).json({ error: '请提供旧密码和新密码' })
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: '新密码至少需要8位' })
    }

    const userId = (req as any).userId
    const success = await changeUserPassword(userId, old_password, new_password)
    if (!success) {
      return res.status(400).json({ error: '旧密码不正确' })
    }
    res.json({ success: true, message: '密码修改成功' })
  } catch (err: any) {
    console.error('[auth/change-password]', err.message)
    res.status(500).json({ error: '修改密码失败，请稍后重试' })
  }
})

// ============ POST /auth/delete-account — 注销账号 ============
router.post('/delete-account', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { password } = req.body
    if (!password) {
      return res.status(400).json({ error: '请提供密码确认' })
    }

    const userId = (req as any).userId
    const success = await deleteUser(userId, password)
    if (!success) {
      return res.status(400).json({ error: '密码不正确' })
    }
    res.json({ success: true, message: '账号已注销' })
  } catch (err: any) {
    console.error('[auth/delete-account]', err.message)
    res.status(500).json({ error: '注销失败，请稍后重试' })
  }
})

export default router
