import { OSS } from 'ali-oss'
import { config } from 'dotenv'

// 加载环境变量（Vercel 会在部署时自动注入）
config()

function getOSSClient() {
  const { OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET, OSS_REGION } = process.env
  if (!OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_BUCKET) {
    throw new Error('OSS_ENV_NOT_SET')
  }
  return new OSS({
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    bucket: OSS_BUCKET,
    region: OSS_REGION || 'oss-cn-hangzhou',
  })
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { key, contentType, method = 'PUT' } = req.body
    if (!key) return res.status(400).json({ error: 'missing key' })

    const client = getOSSClient()
    const url = await client.signatureUrl(key, {
      method: method as 'PUT' | 'GET',
      'Content-Type': contentType || 'application/octet-stream',
      expires: 3600,
    })

    res.status(200).json({ url })
  } catch (err: any) {
    console.error('/api/oss/sign error:', err.message)
    if (err.message === 'OSS_ENV_NOT_SET') {
      return res.status(500).json({ error: '服务器未配置 OSS 环境变量，请在 Vercel 后台设置 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET' })
    }
    res.status(500).json({ error: err.message })
  }
}
