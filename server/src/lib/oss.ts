/**
 * OSS 存储抽象层
 * 封装阿里云 OSS 的初始化和常用操作
 */
import OSS from 'ali-oss'

let ossClient: OSS | null = null

/** 获取/创建 OSS 客户端（单例） */
export function getOSSClient(): OSS {
  if (ossClient) return ossClient

  const accessKeyId = process.env.OSS_ACCESS_KEY_ID
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
  const bucket = process.env.OSS_BUCKET
  const region = process.env.OSS_REGION || 'oss-cn-hangzhou'

  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS 环境变量未配置（OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET）')
  }

  ossClient = new OSS({ accessKeyId, accessKeySecret, bucket, region })
  console.log('[OSS] 客户端已初始化')
  return ossClient
}

/** 生成 Presigned PUT URL（上传） */
export async function generateUploadUrl(key: string, contentType?: string): Promise<string> {
  const client = getOSSClient()
  return client.signatureUrl(key, {
    method: 'PUT',
    'Content-Type': contentType || 'application/octet-stream',
    expires: 3600,
  })
}

/** 生成 Presigned GET URL（下载） */
export async function generateDownloadUrl(key: string): Promise<string> {
  const client = getOSSClient()
  return client.signatureUrl(key, { method: 'GET', expires: 3600 })
}

/** 本地存储降级：当 OSS 不可用时的数据目录 */
const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR || '../data'

/** 生成本地文件路径 */
function getLocalPath(key: string): string {
  // 将 OSS key 转换为本地路径，例如 'memoir/users/users.json' → '../data/memoir/users/users.json'
  return require('path').resolve(__dirname, '..', LOCAL_DATA_DIR, key)
}

/** 从本地文件读取 JSON（降级方案） */
async function readLocalJSON<T = any>(key: string): Promise<T | null> {
  const fs = require('fs/promises')
  const path = getLocalPath(key)
  try {
    await fs.access(path)
    const text = await fs.readFile(path, 'utf-8')
    return JSON.parse(text) as T
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
}

/** 写 JSON 到本地文件（降级方案） */
async function writeLocalJSON(key: string, data: any): Promise<void> {
  const fs = require('fs/promises')
  const path = getLocalPath(key)
  const dir = require('path').dirname(path)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

/** 从 OSS 读取 JSON 文件（带本地降级） */
export async function readJSON<T = any>(key: string): Promise<T | null> {
  try {
    const client = getOSSClient()
    const response = await client.get(key)
    const text = response.content.toString('utf-8')
    return JSON.parse(text) as T
  } catch (err: any) {
    if (err?.code === 'NoSuchKey') return null
    // OSS 失败，尝试本地降级
    console.warn(`[OSS] readJSON 失败，降级到本地存储: ${key}`, err.message)
    try {
      return await readLocalJSON<T>(key)
    } catch {
      return null
    }
  }
}

/** 写 JSON 文件到 OSS（带本地降级） */
export async function writeJSON(key: string, data: any): Promise<void> {
  try {
    const client = getOSSClient()
    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8')
    await client.put(key, content, {
      mime: 'application/json',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    // OSS 失败，降级到本地存储
    console.warn(`[OSS] writeJSON 失败，降级到本地存储: ${key}`, err.message)
    await writeLocalJSON(key, data)
  }
}

/** 从 OSS 读取文本文件 */
export async function readText(key: string): Promise<string | null> {
  try {
    const client = getOSSClient()
    const response = await client.get(key)
    return response.content.toString('utf-8')
  } catch (err: any) {
    if (err?.code === 'NoSuchKey') return null
    throw err
  }
}

/** 写文本文件到 OSS */
export async function writeText(key: string, content: string, contentType?: string): Promise<void> {
  const client = getOSSClient()
  await client.put(key, Buffer.from(content, 'utf-8'), {
    mime: contentType || 'text/plain',
  })
}

/** 删除 OSS 对象 */
export async function deleteObject(key: string): Promise<void> {
  const client = getOSSClient()
  await client.delete(key)
}

/** 读取 OSS 对象为 Buffer */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const client = getOSSClient()
  const result = await client.get(key)
  return result.content as Buffer
}

/** 列出 OSS 对象 */
export async function listObjects(prefix: string, maxKeys = 1000): Promise<string[]> {
  const client = getOSSClient()
  const result = await client.list({ prefix, 'max-keys': maxKeys }, {})
  return (result.objects || []).map((obj: any) => obj.name)
}

/** 检查对象是否存在 */
export async function exists(key: string): Promise<boolean> {
  try {
    const client = getOSSClient()
    await client.head(key)
    return true
  } catch {
    return false
  }
}
