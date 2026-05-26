/**
 * 忆往昔回忆录助手 - 后端服务
 * 端点：/health、/oss/sign、/oss/download、/oss/delete、/oss/list、/telecom/token
 *
 * 环境变量（从 .env 读取，不要提交到 git）：
 *   OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET、OSS_REGION
 *   BACKEND_PORT（默认 3001）
 */

import express from 'express'
import cors from 'cors'
import OSS from 'ali-oss'
import * as crypto from 'node:crypto'
import { config } from 'dotenv'

config() // 加载 .env

const app = express()
const PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 3001

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// ============ 健康检查 ============
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ============ OSS 客户端初始化 ============
function getOSSClient() {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
  const bucket = process.env.OSS_BUCKET
  const region = process.env.OSS_REGION || 'oss-cn-hangzhou'

  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS 环境变量未配置（OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET）')
  }

  return new OSS({
    accessKeyId,
    accessKeySecret,
    bucket,
    region,
  })
}

// ============ OSS Presigned URL 生成 ============

/**
 * POST /oss/sign
 * Body: { key: string, contentType: string, method: 'PUT' | 'GET' }
 * 返回: { url: string } — presigned URL
 */
app.post('/oss/sign', async (req, res) => {
  try {
    const { key, contentType, method = 'PUT' } = req.body
    if (!key) return res.status(400).json({ error: 'missing key' })

    const client = getOSSClient()
    const url = await client.signatureUrl(key, {
      method: method as 'PUT' | 'GET',
      'Content-Type': contentType || 'application/octet-stream',
      expires: 3600, // 1 小时有效
    })

    res.json({ url })
  } catch (err: any) {
    console.error('/oss/sign error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /oss/download
 * Body: { key: string }
 * 返回: { url: string } — presigned GET URL
 */
app.post('/oss/download', async (req, res) => {
  try {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: 'missing key' })

    const client = getOSSClient()
    const url = await client.signatureUrl(key, {
      method: 'GET',
      expires: 3600,
    })

    res.json({ url })
  } catch (err: any) {
    console.error('/oss/download error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /oss/delete
 * Body: { key: string }
 * 返回: { success: true }
 */
app.post('/oss/delete', async (req, res) => {
  try {
    const { key } = req.body
    if (!key) return res.status(400).json({ error: 'missing key' })

    const client = getOSSClient()
    await client.delete(key)
    res.json({ success: true })
  } catch (err: any) {
    console.error('/oss/delete error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /oss/list
 * Body: { prefix: string }
 * 返回: { keys: string[] }
 */
app.post('/oss/list', async (req, res) => {
  try {
    const { prefix } = req.body
    if (!prefix) return res.status(400).json({ error: 'missing prefix' })

    const client = getOSSClient()
    const result = await client.list({ prefix, 'max-keys': 1000 })
    const keys = (result.objects || []).map(obj => obj.name)
    res.json({ keys })
  } catch (err: any) {
    console.error('/oss/list error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ============ 电信能力平台 Token 交换（代理，避免前端暴露 secret）============
app.post('/telecom/token', async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'missing code' })

    const appId = process.env.TELECOM_APP_ID
    const appSecret = process.env.TELECOM_APP_SECRET
    if (!appId || !appSecret) {
      return res.status(500).json({ error: '电信平台配置缺失' })
    }

    // 请求电信能力平台 token 端点
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
    console.error('/telecom/token error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ============ HMAC-SHA256 签名验证（供后端其他服务调用）============
export function verifySignature(
  params: Record<string, string | number>,
  receivedSign: string,
  secret: string
): boolean {
  const sorted = Object.keys(params).sort()
  const raw = sorted.map(k => `${k}=${params[k]}`).join('&')
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  return expected === receivedSign
}

// ============ 启动 ============
app.listen(PORT, () => {
  console.log(`✅ 忆往昔后端服务启动成功：http://localhost:${PORT}`)
  console.log(`   Health:  http://localhost:${PORT}/health`)
  console.log(`   OSS Sign: POST http://localhost:${PORT}/oss/sign`)
})
