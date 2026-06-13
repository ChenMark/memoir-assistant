/**
 * 好友管理验证 Schema (Zod)
 */
import { z } from 'zod'

// 好友分类枚举
const FriendCategoryEnum = z.enum(['family', 'class_mate', 'friend'])

// ============ 创建好友 ============
export const createFriendSchema = z.object({
  name: z.string('好友姓名不能为空')
    .max(100, '好友姓名最多100个字符')
    .trim(),
  avatar: z.string()
    .url('头像必须是有效的URL')
    .max(500, '头像URL最多500个字符')
    .optional(),
  category: FriendCategoryEnum,
  relationship: z.string()
    .max(50, '关系最多50个字符')
    .optional(),
  generation: z.number()
    .int('辈分必须是整数')
    .min(-10, '辈分最小为-10')
    .max(10, '辈分最大为10')
    .optional(),
  parentId: z.string()
    .min(1, '父节点ID不能为空')
    .optional(),
  spouseId: z.string()
    .min(1, '配偶ID不能为空')
    .optional(),
  school: z.string()
    .max(100, '学校名称最多100个字符')
    .optional(),
  classInfo: z.string()
    .max(50, '班级信息最多50个字符')
    .optional(),
  graduationYear: z.string()
    .regex(/^\d{4}$/, '毕业年份格式应为 YYYY')
    .optional(),
  metAt: z.string()
    .max(200, '认识地点最多200个字符')
    .optional(),
  metYear: z.string()
    .regex(/^\d{4}$/, '认识年份格式应为 YYYY')
    .optional(),
  tags: z.array(z.string().max(50, '标签最多50个字符'))
    .max(30, '最多30个标签')
    .default([]),
})

// ============ 更新好友 ============
export const updateFriendSchema = createFriendSchema.partial().extend({
  id: z.string().min(1, '好友ID不能为空'),
})

// ============ 好友查询参数 ============
export const friendQuerySchema = z.object({
  category: FriendCategoryEnum.optional(),
  search: z.string()
    .max(100, '搜索关键词最多100个字符')
    .optional(),
  page: z.coerce.number()
    .int('页码必须是整数')
    .min(1, '页码最小为1')
    .default(1),
  limit: z.coerce.number()
    .int('每页数量必须是整数')
    .min(1, '每页最少1条')
    .max(100, '每页最多100条')
    .default(20),
})

export type CreateFriendInput = z.infer<typeof createFriendSchema>
export type UpdateFriendInput = z.infer<typeof updateFriendSchema>
export type FriendQueryInput = z.infer<typeof friendQuerySchema>
