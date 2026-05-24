import { config } from 'dotenv'
config()

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  const hasOSS = !!(process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET && process.env.OSS_BUCKET)

  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
    hasOSS,
    env: {
      OSS_REGION: process.env.OSS_REGION || 'not_set',
      HAS_TELECOM: !!process.env.TELECOM_APP_ID,
    }
  })
}
