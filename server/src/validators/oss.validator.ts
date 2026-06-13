/**
 * OSS 操作验证 Schema (Zod)
 */
import { z } from 'zod'

// ============ 生成签名 ============
export const signSchema = z.object({
  key: z.string('文件路径(key)不能为空')
    .max(500, '文件路径最多500个字符'),
  contentType: z.string()
    .max(100, 'ContentType最多100个字符')
    .optional(),
  method: z.enum(['PUT', 'GET'])
    .default('PUT'),
})

// ============ 下载签名 ============
export const downloadSchema = z.object({
  key: z.string('文件路径(key)不能为空')
    .max(500, '文件路径最多500个字符'),
})

// ============ 删除对象 ============
export const deleteSchema = z.object({
  key: z.string('文件路径(key)不能为空')
    .max(500, '文件路径最多500个字符'),
})

// ============ 列出对象 ============
export const listSchema = z.object({
  prefix: z.string('前缀(prefix)不能为空')
    .max(500, '前缀最多500个字符'),
})

export type SignInput = z.infer<typeof signSchema>
export type DownloadInput = z.infer<typeof downloadSchema>
export type DeleteInput = z.infer<typeof deleteSchema>
export type ListInput = z.infer<typeof listSchema>
