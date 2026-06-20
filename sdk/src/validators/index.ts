/**
 * 忆往昔 SDK — Zod 验证 Schema
 * 类型安全的请求验证，可用于前后端
 */

import { z } from 'zod'

// ==================== 认证 ====================

export const registerSchema = z.object({
  username: z
    .string('用户名不能为空')
    .min(2, '用户名至少2个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线或中文'),
  email: z.string('邮箱不能为空').email('邮箱格式不正确').toLowerCase(),
  password: z.string('密码不能为空').min(6, '密码至少6个字符').max(50, '密码最多50个字符'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确').optional(),
})

export const loginSchema = z.object({
  account: z.string('账号不能为空').min(1, '账号不能为空'),
  password: z.string('密码不能为空').min(1, '密码不能为空'),
})

export const sendSMSSchema = z.object({
  phone: z
    .string('手机号不能为空')
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
})

export const phoneLoginSchema = z.object({
  phone: z
    .string('手机号不能为空')
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z
    .string('验证码不能为空')
    .length(6, '验证码为6位数字')
    .regex(/^\d+$/, '验证码只能是数字'),
})

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(2, '用户名至少2个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线或中文')
    .optional(),
  bio: z.string().max(200, '个人简介最多200个字符').optional(),
  avatar: z.string().url('头像必须是有效的URL').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确').optional(),
})

// ==================== 回忆录 ====================

export const createMemoirSchema = z.object({
  title: z.string('标题不能为空').max(200, '标题最多200个字符').trim(),
  content: z.string().max(50000, '内容最多50000个字符').default(''),
  date: z
    .string('日期不能为空')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  tags: z.array(z.string().max(50, '标签最多50个字符')).max(20, '最多20个标签').default([]),
  mood: z.string().max(50, '心情最多50个字符').optional(),
  location: z.string().max(200, '地点最多200个字符').optional(),
  media: z
    .array(z.string().max(500, '媒体路径最多500个字符'))
    .max(50, '最多50个媒体文件')
    .default([]),
  isPublished: z.boolean().default(true),
})

export const updateMemoirSchema = createMemoirSchema.partial()

// ==================== 草稿 ====================

export const saveDraftSchema = z.object({
  id: z.string().min(1, '草稿ID不能为空').optional(),
  title: z.string().max(200, '标题最多200个字符').default('未命名草稿'),
  content: z.string().max(50000, '内容最多50000个字符').default(''),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
    .optional(),
  tags: z.array(z.string().max(50, '标签最多50个字符')).max(20, '最多20个标签').default([]),
  mood: z.string().max(50, '心情最多50个字符').optional(),
  media: z
    .array(z.string().max(500, '媒体路径最多500个字符'))
    .max(50, '最多50个媒体文件')
    .default([]),
})

// ==================== 画廊 ====================

export const createGallerySchema = z.object({
  ossKey: z.string('图片地址不能为空').max(500, '图片地址最多500个字符'),
  caption: z.string().max(500, '描述最多500个字符').default(''),
  tags: z.array(z.string().max(50, '标签最多50个字符')).max(20, '最多20个标签').default([]),
  date: z
    .string('日期不能为空')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
  memoirId: z.string().optional(),
})

// ==================== AI 对话 ====================

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant'], {
    error: '角色必须是 system/user/assistant 之一',
  }),
  content: z
    .string('消息内容不能为空')
    .max(10000, '单条消息最多10000个字符'),
})

export const chatSchema = z.object({
  messages: z
    .array(chatMessageSchema, 'messages 必须是消息数组')
    .min(1, '至少需要1条消息')
    .max(100, '最多100条消息'),
  dimensionId: z
    .string('dimensionId 不能为空')
    .max(50, 'dimensionId最多50个字符'),
})

export const generateStorySchema = z.object({
  messages: z
    .array(chatMessageSchema, 'messages 必须是消息数组')
    .min(1, '至少需要1条消息')
    .max(100, '最多100条消息'),
})

// ==================== 好友 ====================

const FriendCategoryEnum = z.enum(['family', 'class_mate', 'friend'])

export const createFriendSchema = z.object({
  name: z.string('好友姓名不能为空').max(100, '好友姓名最多100个字符').trim(),
  avatar: z.string().url('头像必须是有效的URL').max(500, '头像URL最多500个字符').optional(),
  category: FriendCategoryEnum,
  relationship: z.string().max(50, '关系最多50个字符').optional(),
  generation: z
    .number()
    .int('辈分必须是整数')
    .min(-10, '辈分最小为-10')
    .max(10, '辈分最大为10')
    .optional(),
  parentId: z.string().min(1, '父节点ID不能为空').optional(),
  spouseId: z.string().min(1, '配偶ID不能为空').optional(),
  school: z.string().max(100, '学校名称最多100个字符').optional(),
  classInfo: z.string().max(50, '班级信息最多50个字符').optional(),
  graduationYear: z
    .string()
    .regex(/^\d{4}$/, '毕业年份格式应为 YYYY')
    .optional(),
  metAt: z.string().max(200, '认识地点最多200个字符').optional(),
  metYear: z
    .string()
    .regex(/^\d{4}$/, '认识年份格式应为 YYYY')
    .optional(),
  tags: z.array(z.string().max(50, '标签最多50个字符')).max(30, '最多30个标签').default([]),
})

export const updateFriendSchema = createFriendSchema.partial().extend({
  id: z.string().min(1, '好友ID不能为空'),
})

// ==================== 爱好 ====================

const HobbyCategoryEnum = z.enum(['music', 'movie', 'sport', 'custom'])

export const createHobbySchema = z.object({
  category: HobbyCategoryEnum,
  title: z.string('名称不能为空').max(200, '名称最多200个字符').trim(),
  description: z.string().max(5000, '描述最多5000个字符').default(''),
  rating: z
    .number()
    .int('评分必须是整数')
    .min(1, '评分最小为1')
    .max(5, '评分最大为5')
    .optional(),
  year: z
    .string()
    .regex(/^\d{4}$/, '年份格式应为 YYYY')
    .optional(),
  tags: z.array(z.string().max(50, '标签最多50个字符')).max(20, '最多20个标签').default([]),
})

// ==================== OSS ====================

export const ossSignSchema = z.object({
  key: z.string('文件路径(key)不能为空').max(500, '文件路径最多500个字符'),
  contentType: z.string().max(100, 'ContentType最多100个字符').optional(),
  method: z.enum(['PUT', 'GET']).default('PUT'),
})

export const ossDownloadSchema = z.object({
  key: z.string('文件路径(key)不能为空').max(500, '文件路径最多500个字符'),
})

export const ossDeleteSchema = z.object({
  key: z.string('文件路径(key)不能为空').max(500, '文件路径最多500个字符'),
})

export const ossListSchema = z.object({
  prefix: z.string('前缀(prefix)不能为空').max(500, '前缀最多500个字符'),
})

// ==================== 分页 ====================

export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int('页码必须是整数')
    .min(1, '页码最小为1')
    .default(1),
  limit: z.coerce
    .number()
    .int('每页数量必须是整数')
    .min(1, '每页最少1条')
    .max(100, '每页最多100条')
    .default(20),
})

// ==================== 类型导出 ====================

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SendSMSInput = z.infer<typeof sendSMSSchema>
export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreateMemoirInput = z.infer<typeof createMemoirSchema>
export type UpdateMemoirInput = z.infer<typeof updateMemoirSchema>
export type SaveDraftInput = z.infer<typeof saveDraftSchema>
export type CreateGalleryInput = z.infer<typeof createGallerySchema>
export type ChatInput = z.infer<typeof chatSchema>
export type GenerateStoryInput = z.infer<typeof generateStorySchema>
export type CreateFriendInput = z.infer<typeof createFriendSchema>
export type UpdateFriendInput = z.infer<typeof updateFriendSchema>
export type CreateHobbyInput = z.infer<typeof createHobbySchema>
export type OSSSignInput = z.infer<typeof ossSignSchema>
export type OSSDownloadInput = z.infer<typeof ossDownloadSchema>
export type OSSDeleteInput = z.infer<typeof ossDeleteSchema>
export type OSSListInput = z.infer<typeof ossListSchema>
export type PaginationInput = z.infer<typeof paginationSchema>

/** 校验并返回数据（抛出 ZodError） */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data)
}

/** 安全校验，返回结果对象 */
export function safeValidate<T>(schema: z.ZodType<T>, data: unknown) {
  return schema.safeParse(data)
}
