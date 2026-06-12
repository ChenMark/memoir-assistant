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
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 加载根目录的 .env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
config({ path: path.resolve(__dirname, '../../.env') })

import authRoutes, { authMiddleware } from './routes/auth.js'
import ossRoutes from './routes/oss.js'
import memoirRoutes from './routes/memoir.js'
import aiRoutes from './routes/ai.js'

const app = express()
const PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 3002

// ============ 环境变量验证 ============
function validateEnv() {
  const required = ['JWT_SECRET']
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`❌ 缺少必需的环境变量: ${missing.join(', ')}`)
    console.error('请在 .env 文件中配置这些变量，然后重启服务。')
    process.exit(1)
  }
}
validateEnv()

// ============ 请求日志中间件 ============
function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const start = Date.now()
  const { method, originalUrl } = req
  // 在响应完成时记录日志
  _res.on('finish', () => {
    const duration = Date.now() - start
    const status = _res.statusCode
    const statusIcon = status >= 500 ? '❌' : status >= 400 ? '⚠️' : status >= 300 ? '↪️' : '✅'
    console.log(`[${new Date().toLocaleTimeString('zh-CN')}] ${statusIcon} ${method} ${originalUrl} ${status} ${duration}ms`)
  })
  next()
}

// ============ 中间件 ============
// CORS 白名单配置
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080'
]

app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（同源请求、移动端、Postman 等）
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    
    console.warn(`[CORS] 拒绝来源: ${origin}`)
    callback(new Error('CORS policy: origin not allowed'))
  },
  credentials: true,
  maxAge: 86400, // 24小时预检缓存
}))

// 全局限流：15分钟内最多100次请求
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: '请求过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(requestLogger)
app.use(express.json({ limit: '50mb' }))
app.use(globalLimiter)

// ============ 路由注册 ============
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), uptime: process.uptime() })
})

app.use('/auth', authRoutes)
app.use('/oss', authMiddleware, ossRoutes)
app.use('/memoir', authMiddleware, memoirRoutes)
app.use('/ai', authMiddleware, aiRoutes)

// ============ 电信能力平台 Token 交换 ============
app.post('/telecom/token', async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ success: false, error: 'missing code' })

    const appId = process.env.TELECOM_APP_ID
    const appSecret = process.env.TELECOM_APP_SECRET
    if (!appId || !appSecret) return res.status(500).json({ success: false, error: '电信平台配置缺失' })

    const tokenRes = await fetch('https://oauth.api.189.cn/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, app_id: appId, app_secret: appSecret }),
    })
    const data = await tokenRes.json()
    res.status(tokenRes.status).json(data)
  } catch (err: any) {
    console.error('[telecom/token]', err.message)
    res.status(500).json({ success: false, error: err.message || 'Token 交换失败' })
  }
})

// ============ 404 ============
app.use((_req, res) => {
  res.status(404).json({ success: false, error: '接口不存在', path: _req.path })
})

// ============ 全局错误处理 ============
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error]', err.message, err.stack)
  const status = err.status || 500
  const message = status >= 500 ? '服务器内部错误' : (err.message || '请求处理失败')
  res.status(status).json({ success: false, error: message, ...(err.details && { details: err.details }) })
})

// ============ 启动 ============
app.listen(PORT, () => {
  console.log('')
  console.log(`  ✅  忆往昔后端服务已启动：http://localhost:${PORT}`)
  console.log(`  🩺  Health:    http://localhost:${PORT}/health`)
  console.log(`  🔐  Auth:      http://localhost:${PORT}/auth/*`)
  console.log(`  📦  OSS:       http://localhost:${PORT}/oss/*`)
  console.log(`  📝  Memoir:    http://localhost:${PORT}/memoir/*`)
  console.log(`  🤖  AI:        http://localhost:${PORT}/ai/*`)
  console.log(`  📞  Telecom:   http://localhost:${PORT}/telecom/token`)
  console.log('')
})

export default app
