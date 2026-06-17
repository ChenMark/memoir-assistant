/**
 * 版本路由 — OTA 在线更新
 */
import { Router } from 'express'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const router = Router()

// 使用 process.cwd() 定位项目根目录
const rootDir = process.cwd()

// 尝试读取 package.json 获取版本号
let appVersion = '1.2.0'
let buildTime = ''
try {
  const pkgPath = join(rootDir, 'package.json')
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    appVersion = pkg.version || appVersion
  }
} catch {}

// 尝试读取 BUILD_ID（CI/CD 注入）
try {
  const buildIdPath = join(rootDir, '.build_id')
  if (existsSync(buildIdPath)) {
    buildTime = readFileSync(buildIdPath, 'utf-8').trim()
  }
} catch {
  buildTime = new Date().toISOString()
}

/** GET /api/version — 返回当前版本信息 */
router.get('/version', (_req, res) => {
  res.json({
    version: appVersion,
    buildTime,
    env: process.env.NODE_ENV || 'development',
    features: [
      'ai-interview',
      'gallery-share',
      'hobby-tracker',
      'family-tree',
      'oss-upload',
      'pdf-export',
    ],
    minClientVersion: '1.0.0',
    forceUpdate: false,
  })
})

export default router
