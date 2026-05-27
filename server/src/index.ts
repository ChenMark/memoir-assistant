/**
 * 忆往昔回忆录助手 — 后端服务入口
 *
 * 路由结构：
 *   /health           健康检查
 *   /auth/*           认证（注册/登录/短信/第三方）
 *   /oss/*            OSS 操作（签名/下载/删除/列表）
 *   /memoir/*         回忆录 CRUD
 *   /memoir/draft/*   草稿管理
 *   /memoir/gallery/* 画廊管理
 *   /telecom/token    电信能力平台 Token 代理
 *
 * 环境变量（从 ../.env 读取）：
 *   OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET / OSS_REGION
 *   JWT_SECRET / BACKEND_PORT
 *   WECHAT_APP_ID / WECHAT_APP_SECRET / QQ_APP_ID / QQ_APP_KEY
 */
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 加载根目录的 .env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../.env') })

import authRoutes from './routes/auth.js'
import ossRoutes from './routes/oss.js'
import memoirRoutes from './routes/memoir.js'

const app = express()
const PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 3002

// ============ 中间件 ============
app.use(cors())
app.use(express.json({ limit: '50mb' }))

// ============ 路由注册 ============
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), uptime: process.uptime() })
})

app.use('/auth', authRoutes)
app.use('/oss', ossRoutes)
app.use('/memoir', memoirRoutes)

// ============ 电信能力平台 Token 交换 ============
app.post('/telecom/token', async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'missing code' })

    const appId = process.env.TELECOM_APP_ID
    const appSecret = process.env.TELECOM_APP_SECRET
    if (!appId || !appSecret) return res.status(500).json({ error: '电信平台配置缺失' })

    const tokenRes = await fetch('https://oauth.api.189.cn/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, app_id: appId, app_secret: appSecret }),
    })
    const data = await tokenRes.json()
    res.status(tokenRes.status).json(data)
  } catch (err: any) {
    console.error('[telecom/token]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ============ 404 ============
app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// ============ 全局错误处理 ============
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err)
  res.status(500).json({ error: '服务器内部错误' })
})

// ============ 启动 ============
app.listen(PORT, () => {
  console.log('')
  console.log(`  ✅  忆往昔后端服务已启动：http://localhost:${PORT}`)
  console.log(`  📋  Health:    http://localhost:${PORT}/health`)
  console.log(`  🔐  Auth:      http://localhost:${PORT}/auth/*`)
  console.log(`  📦  OSS:       http://localhost:${PORT}/oss/*`)
  console.log(`  📝  Memoir:    http://localhost:${PORT}/memoir/*`)
  console.log(`  📞  Telecom:   http://localhost:${PORT}/telecom/token`)
  console.log('')
})

export default app
