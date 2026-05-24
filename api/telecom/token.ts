import { config } from 'dotenv'

config()

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'missing code' })

    const appId = process.env.TELECOM_APP_ID
    const appSecret = process.env.TELECOM_APP_SECRET
    if (!appId || !appSecret) {
      return res.status(500).json({ error: '电信平台配置缺失，请在 Vercel 后台设置 TELECOM_APP_ID / TELECOM_APP_SECRET' })
    }

    const tokenRes = await fetch('https://oauth.api.189.cn/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        app_id: appId,
        app_secret: appSecret,
      }),
    })

    const data = await tokenRes.json()
    res.status(tokenRes.status).json(data)
  } catch (err: any) {
    console.error('/api/telecom/token error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
