import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getOrCreateQQUser, generateToken, sanitizeUser } from './_utils'
import crypto from 'crypto'

/**
 * QQ 互联 OAuth 2.0 授权
 *
 * 流程：
 * 1. 前端调用 GET /api/auth/qq-auth 获取授权 URL
 * 2. 用户授权后，QQ 回调 redirect_uri 带 code
 * 3. 前端用 code 调用 GET /api/auth/qq-auth?code=xxx
 * 4. 后端用 code 换 access_token + openId，创建/查找用户，返回 JWT
 *
 * 配置要求：
 * - QQ_APP_ID：QQ 互联 App ID
 * - QQ_APP_KEY：QQ 互联 App Key
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const QQ_APP_ID = process.env.QQ_APP_ID || ''
  const QQ_APP_KEY = process.env.QQ_APP_KEY || ''

  const isDemo = !QQ_APP_ID || !QQ_APP_KEY

  if (isDemo) {
    // ========== 演示模式 ==========
    if (req.method === 'GET' && req.query?.demo === 'true') {
      try {
        const user = await getOrCreateQQUser({
          openId: 'demo_qq_openid_' + Date.now(),
          nickname: 'QQ演示用户',
          avatar: '',
        })
        const token = generateToken(user)
        return res.status(200).json({
          message: 'QQ登录成功（演示模式）',
          user: sanitizeUser(user),
          token,
        })
      } catch (e: any) {
        return res.status(500).json({ error: e.message })
      }
    }

    return res.status(200).json({
      demo: true,
      message: 'QQ登录需要配置 QQ_APP_ID 和 QQ_APP_KEY 环境变量',
      configRequired: ['QQ_APP_ID', 'QQ_APP_KEY'],
      demoAuthUrl: `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/api/auth/qq-auth?demo=true`,
    })
  }

  // ========== 生产模式 ==========
  if (req.method === 'GET') {
    const code = req.query?.code as string

    if (!code) {
      // Step 1: 返回授权 URL
      const redirectUri = req.query?.redirect_uri as string || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/qq-auth`
      const state = (req.query?.state as string) || crypto.randomUUID()

      const authUrl = `https://graph.qq.com/oauth2.0/authorize`
        + `?response_type=code`
        + `&client_id=${QQ_APP_ID}`
        + `&redirect_uri=${encodeURIComponent(redirectUri)}`
        + `&scope=get_user_info`
        + `&state=${state}`

      return res.status(200).json({ authUrl, state })
    }

    // Step 2: 用 code 换 access_token
    try {
      const redirectUri = req.query?.redirect_uri as string || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/qq-auth`

      const tokenRes = await fetch(
        `https://graph.qq.com/oauth2.0/token`
        + `?grant_type=authorization_code`
        + `&client_id=${QQ_APP_ID}`
        + `&client_secret=${QQ_APP_KEY}`
        + `&code=${code}`
        + `&redirect_uri=${encodeURIComponent(redirectUri)}`
        + `&fmt=json`
      )
      const tokenData = await tokenRes.json()

      if (tokenData.error || !tokenData.access_token) {
        console.error('[QQAuth] 获取 token 失败:', tokenData)
        return res.status(401).json({ error: 'QQ授权失败: ' + (tokenData.error_description || '未知错误') })
      }

      // Step 3: 获取 openId
      const openIdRes = await fetch(
        `https://graph.qq.com/oauth2.0/me?access_token=${tokenData.access_token}&fmt=json`
      )
      const openIdData = await openIdRes.json()

      if (openIdData.error || !openIdData.openid) {
        console.error('[QQAuth] 获取 openId 失败:', openIdData)
        return res.status(401).json({ error: '获取QQ用户标识失败' })
      }

      // Step 4: 获取用户信息
      const userInfoRes = await fetch(
        `https://graph.qq.com/user/get_user_info`
        + `?access_token=${tokenData.access_token}`
        + `&oauth_consumer_key=${QQ_APP_ID}`
        + `&openid=${openIdData.openid}`
      )
      const userInfo = await userInfoRes.json()

      // Step 5: 创建/查找用户
      const user = await getOrCreateQQUser({
        openId: openIdData.openid,
        nickname: userInfo.nickname || 'QQ用户',
        avatar: userInfo.figureurl_qq_2 || userInfo.figureurl_qq_1 || '',
      })

      const jwtToken = generateToken(user)

      return res.status(200).json({
        message: 'QQ登录成功',
        user: sanitizeUser(user),
        token: jwtToken,
      })
    } catch (e: any) {
      console.error('[QQAuth] 错误:', e)
      return res.status(500).json({ error: e.message || 'QQ登录失败' })
    }
  }

  return res.status(405).json({ error: '仅支持 GET 方法' })
}
