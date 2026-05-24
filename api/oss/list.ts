import { OSS } from 'ali-oss'
import { config } from 'dotenv'

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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { prefix } = req.body
    if (!prefix) return res.status(400).json({ error: 'missing prefix' })

    const client = getOSSClient()
    const result = await client.list({ prefix, 'max-keys': 1000 })
    const keys = (result.objects || []).map((obj: any) => obj.name)
    res.status(200).json({ keys })
  } catch (err: any) {
    console.error('/api/oss/list error:', err.message)
    if (err.message === 'OSS_ENV_NOT_SET') {
      return res.status(500).json({ error: 'OSS 环境变量未配置' })
    }
    res.status(500).json({ error: err.message })
  }
}
