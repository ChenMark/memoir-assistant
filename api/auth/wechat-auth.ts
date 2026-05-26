import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getOrCreateWechatUser, generateToken, sanitizeUser } from './_utils'

/**
 * 微信 OAuth 授权
 *
 * 通信流程：
 * 1. 前端调用此接口获取微信授权 URL
 * 2. 用户扫码/点击授权后，微信回调 redirect_uri
 * 3. 前端从 URL 获取 code，调用 GET /api/auth/wechat-auth?code=xxx
 * 4. 后端用 code 换 access_token + openId，创建/查找用户，返回 JWT
 *
 * 配置要求（环境变量）：
 * - WECHAT_APP_ID：微信开放平台 AppID
 * - WECHAT_APP_SECRET：微信开放平台 AppSecret
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const WECHAT_APP_ID = process.env.WECHAT_APP_ID || ''
  const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || ''

  // 演示模式
  const isDemo = !WECHAT_APP_ID || !WECHAT_APP_SECRET

  if (isDemo) {
    // ========== 演示模式 ==========
    if (req.method === 'GET' && req.query?.demo === 'true') {
      // 模拟微信授权回调
      try {
        const user = await getOrCreateWechatUser({
          openId: 'demo_wx_openid_' + Date.now(),
          nickname: '微信演示用户',
          avatar: '',
        })
        const token = generateToken(user)
        return res.status(200).json({
          message: '微信登录成功（演示模式）',
          user: sanitizeUser(user),
          token,
        })
      } catch (e: any) {
        return res.status(500).json({ error: e.message })
      }
    }

    return res.status(200).json({
      demo: true,
      message: '微信登录需要配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET 环境变量',
      configRequired: ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'],
      // 演示模式下的授权 URL（供前端模拟）
      demoAuthUrl: `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/api/auth/wechat-auth?demo=true`,
    })
  }

  // ========== 生产模式 ==========
  if (req.method === 'GET') {
    const code = req.query?.code as string

    if (!code) {
      // Step 1: 返回授权 URL
      const redirectUri = req.query?.redirect_uri as string || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/wechat-auth`
      const state = (req.query?.state as string) || crypto.randomUUID()

      const authUrl = `https://open.weixin.qq.com/connect/qrconnect`
        + `?appid=${WECHAT_APP_ID}`
        + `&redirect_uri=${encodeURIComponent(redirectUri)}`
        + `&response_type=code`
        + `&scope=snsapi_login`
        + `&state=${state}`
        + `#wechat_redirect`

      return res.status(200).json({ authUrl, state })
    }

    // Step 2: 用 code 换 access_token
    try {
      const tokenRes = await fetch(
        `https://api.weixin.qq.com/sns/oauth2/access_token`
        + `?appid=${WECHAT_APP_ID}`
        + `&secret=${WECHAT_APP_SECRET}`
        + `&code=${code}`
        + `&grant_type=authorization_code`
      )
      const tokenData = await tokenRes.json()

      if (tokenData.errcode || !tokenData.openid) {
        console.error('[WechatAuth] 获取 token 失败:', tokenData)
        return res.status(401).json({ error: '微信授权失败: ' + (tokenData.errmsg || '未知错误') })
      }

      // Step 3: 获取用户信息
      const userInfoRes = await fetch(
        `https://api.weixin.qq.com/sns/userinfo`
        + `?access_token=${tokenData.access_token}`
        + `&openid=${tokenData.openid}`
        + `&lang=zh_CN`
      )
      const userInfo = await userInfoRes.json()

      // Step 4: 创建/查找用户
      const user = await getOrCreateWechatUser({
        openId: tokenData.openid,
        unionId: tokenData.unionid,
        nickname: userInfo.nickname || '微信用户',
        avatar: userInfo.headimgurl || '',
      })

      const jwtToken = generateToken(user)

      return res.status(200).json({
        message: '微信登录成功',
        user: sanitizeUser(user),
        token: jwtToken,
      })
    } catch (e: any) {
      console.error('[WechatAuth] 错误:', e)
      return res.status(500).json({ error: e.message || '微信登录失败' })
    }
  }

  return res.status(405).json({ error: '仅支持 GET 方法' })
}
