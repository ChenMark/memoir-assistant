/**
 * 忆往昔回忆录助手 — 后端服务入口
 * v1.1.0: 新增 /api/v1/ 版本前缀 + 分页支持
 * 
 * 路由结构：
 *   /api/v1/health           健康检查
 *   /api/v1/auth/*           认证（注册/登录/短信/第三方）
 *   /api/v1/oss/*            OSS 操作（签名/下载/删除/列表）
 *   /api/v1/memoir/*         回忆录 CRUD
 *   /api/v1/memoir/draft/*   草稿管理
 *   /api/v1/memoir/gallery/* 画廊管理
 *   /api/v1/telecom/token    电信能力平台 Token 代理
 *   /api/v1/friend/*         好友管理
 *   /api/v1/hobby/*          爱好管理
 *   /api/v1/ai/*             AI 功能
 *   /api/v1/shared/photo/:token  公开分享访问
 * 环境变量（从 ../.env 读取）：
 *   OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET / OSS_REGION
 *   JWT_SECRET / BACKEND_PORT
 *   WECHAT_APP_ID / WECHAT_APP_SECRET / QQ_APP_ID / QQ_APP_KEY
 */
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import compression from 'compression'
import { config } from 'dotenv'
import path from 'node:path'

// 加载根目录的 .env
config({ path: path.resolve(__dirname, '../../.env') })

import authRoutes, { authMiddleware } from './routes/auth.js'
import ossRoutes from './routes/oss.js'
import memoirRoutes from './routes/memoir.js'
import aiRoutes from './routes/ai.js'
import friendRoutes from './routes/friend.js'
import galleryInteractRoutes, { sharedPhotoHandler } from './routes/gallery-interact.js'
import hobbyRoutes from './routes/hobby.js'
import versionRoutes from './routes/version.js'
import { requestLogger } from './middleware/requestLogger.js'
import { sanitizeInput } from './middleware/sanitize.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
const PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 3002
const API_PREFIX = '/api/v1'

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

// ============ 中间件 ============
// CORS 白名单配置
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080'
]

// Security headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}))

// CORS
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

// Gzip 响应压缩 (跳过小响应和已压缩的MIME类型)
app.use(compression({
  threshold: 1024,        // 只压缩 >1KB 的响应
  filter: (req, _res) => {
    // 不压缩健康检查
    if (req.path === `${API_PREFIX}/health`) return false
    return compression.filter(req, _res)
  },
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
// 全局 body 解析：1MB (足够覆盖聊天消息，拒绝过大的恶意请求)
app.use(express.json({ limit: '1mb' }))
app.use(sanitizeInput)
app.use(globalLimiter)

// 小 payload 路由的额外大小检查中间件
function bodySizeLimit(maxBytes: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const len = parseInt(req.headers['content-length'] || '0', 10)
    if (len > maxBytes) {
      return _res.status(413).json({ error: '请求体过大' })
    }
    next()
  }
}

// ============ 路由注册 (v1) ============
app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), uptime: process.uptime(), version: '1.1.0' })
})

// Auth 路由：限制 10KB
app.use(`${API_PREFIX}/auth`, bodySizeLimit(10 * 1024), authRoutes)
// OSS 路由：限制 10KB
app.use(`${API_PREFIX}/oss`, authMiddleware, bodySizeLimit(10 * 1024), ossRoutes)
// Memoir 路由：限制 200KB (回忆录可能较长)
app.use(`${API_PREFIX}/memoir`, authMiddleware, bodySizeLimit(200 * 1024), memoirRoutes)
// AI 路由：限制 1MB (聊天消息数组)
app.use(`${API_PREFIX}/ai`, authMiddleware, bodySizeLimit(1 * 1024 * 1024), aiRoutes)
// Friend 路由：限制 10KB
app.use(`${API_PREFIX}/friend`, authMiddleware, bodySizeLimit(10 * 1024), friendRoutes)
// Hobby 路由：限制 10KB
app.use(`${API_PREFIX}/hobby`, authMiddleware, bodySizeLimit(10 * 1024), hobbyRoutes)

// 画廊交互（评论+分享）：需要认证
app.use(`${API_PREFIX}/memoir/gallery`, authMiddleware, bodySizeLimit(10 * 1024), galleryInteractRoutes)
// 公开分享访问：无需认证
app.get(`${API_PREFIX}/shared/photo/:token`, sharedPhotoHandler)

// 版本信息（无需认证，供 OTA 检查）
app.use('/api', versionRoutes)

// ============ 电信能力平台 Token 交换 ============
app.post(`${API_PREFIX}/telecom/token`, async (req, res) => {
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
app.use(errorHandler)

// ============ 启动 ============
app.listen(PORT, () => {
  console.log('')
  console.log(`  ✅  忆往昔后端服务已启动：http://localhost:${PORT}`)
  console.log(`  🩺  Health:    http://localhost:${PORT}${API_PREFIX}/health`)
  console.log(`  🔐  Auth:      http://localhost:${PORT}${API_PREFIX}/auth/*`)
  console.log(`  📦  OSS:       http://localhost:${PORT}${API_PREFIX}/oss/*`)
  console.log(`  📝  Memoir:    http://localhost:${PORT}${API_PREFIX}/memoir/*`)
  console.log(`  🤖  AI:        http://localhost:${PORT}${API_PREFIX}/ai/*`)
  console.log(`  👥  Friend:    http://localhost:${PORT}${API_PREFIX}/friend/*`)
  console.log(`  🎵  Hobby:     http://localhost:${PORT}${API_PREFIX}/hobby/*`)
  console.log(`  📞  Telecom:   http://localhost:${PORT}${API_PREFIX}/telecom/token`)
  console.log('')
})

export default app
