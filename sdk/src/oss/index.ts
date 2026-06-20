/**
 * 忆往昔 SDK — OSS 客户端抽象
 * 提供 OSS 操作的标准接口和 fetch-based 默认实现
 */

import type { OSSClient, OSSConfig, OSSSignOptions } from '../types/index.js'

/**
 * 创建基于 fetch 的 OSS 客户端
 * 通过服务端 API 签名代理，避免在前端暴露密钥
 */
export function createOSSClient(
  baseUrl: string,
  token?: string
): OSSClient {
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${baseUrl}/api/v1/oss/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`OSS ${path} error: ${res.status}`)
    return res.json() as Promise<T>
  }

  return {
    generateUploadUrl: async (key: string, contentType?: string) => {
      const data = await request<{ url: string }>('sign', {
        key,
        contentType,
        method: 'PUT',
      })
      return data.url
    },

    generateDownloadUrl: async (key: string) => {
      const data = await request<{ url: string }>('download', { key })
      return data.url
    },

    deleteObject: async (key: string) => {
      await request('delete', { key })
    },

    exists: async (key: string) => {
      try {
        await request('download', { key })
        return true
      } catch {
        return false
      }
    },

    listObjects: async (prefix: string) => {
      const data = await request<{ objects: string[] }>('list', { prefix })
      return data.objects
    },
  }
}

/**
 * 直接上传到 OSS Presigned URL
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  data: Buffer | Blob,
  contentType?: string
): Promise<boolean> {
  try {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      headers: contentType ? { 'Content-Type': contentType } : {},
      body: data,
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 生成 OSS 对象 Key
 */
export function generateOSSKey(userId: string, category: string, filename: string): string {
  const ext = filename.split('.').pop() || 'bin'
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `memoir/${userId}/${category}/${timestamp}_${random}.${ext}`
}

/**
 * 从 OSS Key 提取文件名
 */
export function extractFilename(key: string): string {
  return key.split('/').pop() || key
}

/**
 * 支持的图片 MIME 类型
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
] as const

/**
 * 支持的视频 MIME 类型
 */
export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
] as const

/**
 * 文件大小限制（字节）
 */
export const FILE_SIZE_LIMITS = {
  photo: 10 * 1024 * 1024,   // 10MB
  video: 100 * 1024 * 1024,  // 100MB
  avatar: 2 * 1024 * 1024,   // 2MB
} as const

/**
 * 校验文件是否允许上传
 */
export function validateFile(
  file: { type: string; size: number },
  allowedTypes: readonly string[],
  maxSize: number
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `不支持的文件类型: ${file.type}` }
  }
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024)
    return { valid: false, error: `文件大小不能超过 ${maxMB}MB` }
  }
  return { valid: true }
}
