/**
 * 回忆录、草稿、画廊验证 Schema (Zod)
 */
import { z } from 'zod'

// ============ 回忆录 Memoir ============

export const createMemoirSchema = z.object({
  title: z.string('标题不能为空')
    .max(200, '标题最多200个字符')
    .trim(),
  content: z.string()
    .max(50000, '内容最多50000个字符')
    .default(''),
  date: z.string('日期不能为空')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  tags: z.array(z.string().max(50, '标签最多50个字符'))
    .max(20, '最多20个标签')
    .default([]),
  mood: z.string()
    .max(50, '心情最多50个字符')
    .optional(),
  location: z.string()
    .max(200, '地点最多200个字符')
    .optional(),
  media: z.array(z.string().max(500, '媒体路径最多500个字符'))
    .max(50, '最多50个媒体文件')
    .default([]),
  isPublished: z.boolean()
    .default(true),
})

export const updateMemoirSchema = createMemoirSchema.partial().extend({
  id: z.string().min(1, 'ID不能为空'),
})

// ============ 草稿 Draft ============

export const saveDraftSchema = z.object({
  id: z.string().min(1, '草稿ID不能为空').optional(),
  title: z.string()
    .max(200, '标题最多200个字符')
    .default('未命名草稿'),
  content: z.string()
    .max(50000, '内容最多50000个字符')
    .default(''),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
    .optional(),
  tags: z.array(z.string().max(50, '标签最多50个字符'))
    .max(20, '最多20个标签')
    .default([]),
  mood: z.string()
    .max(50, '心情最多50个字符')
    .optional(),
  media: z.array(z.string().max(500, '媒体路径最多500个字符'))
    .max(50, '最多50个媒体文件')
    .default([]),
})

// ============ 画廊 Gallery ============

export const createGallerySchema = z.object({
  ossKey: z.string('图片地址不能为空')
    .max(500, '图片地址最多500个字符'),
  caption: z.string()
    .max(500, '描述最多500个字符')
    .default(''),
  tags: z.array(z.string().max(50, '标签最多50个字符'))
    .max(20, '最多20个标签')
    .default([]),
  date: z.string('日期不能为空')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  memoirId: z.string()
    .optional(),
})

export const updateGallerySchema = createGallerySchema.partial().extend({
  id: z.string().min(1, 'ID不能为空'),
})

export type CreateMemoirInput = z.infer<typeof createMemoirSchema>
export type UpdateMemoirInput = z.infer<typeof updateMemoirSchema>
export type SaveDraftInput = z.infer<typeof saveDraftSchema>
export type CreateGalleryInput = z.infer<typeof createGallerySchema>
export type UpdateGalleryInput = z.infer<typeof updateGallerySchema>
