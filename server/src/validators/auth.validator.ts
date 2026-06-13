/**
 * 认证相关验证 Schema (Zod)
 */
import { z } from 'zod'

// ============ 注册 ============
export const registerSchema = z.object({
  username: z.string('用户名不能为空')
    .min(2, '用户名至少2个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线或中文'),
  email: z.string('邮箱不能为空')
    .email('邮箱格式不正确')
    .toLowerCase(),
  password: z.string('密码不能为空')
    .min(6, '密码至少6个字符')
    .max(50, '密码最多50个字符'),
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),
})

// ============ 登录 ============
export const loginSchema = z.object({
  account: z.string('账号不能为空').min(1, '账号不能为空'),
  password: z.string('密码不能为空').min(1, '密码不能为空'),
})

// ============ 发送短信 ============
export const sendSMSSchema = z.object({
  phone: z.string('手机号不能为空')
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
})

// ============ 手机号登录 ============
export const phoneLoginSchema = z.object({
  phone: z.string('手机号不能为空')
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string('验证码不能为空')
    .length(6, '验证码为6位数字')
    .regex(/^\d+$/, '验证码只能是数字'),
})

// ============ 更新用户信息 ============
export const updateUserSchema = z.object({
  username: z.string()
    .min(2, '用户名至少2个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线或中文')
    .optional(),
  bio: z.string()
    .max(200, '个人简介最多200个字符')
    .optional(),
  avatar: z.string()
    .url('头像必须是有效的URL')
    .optional(),
})

// ============ 微信/QQ OAuth ============
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, '授权码不能为空'),
  state: z.string().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SendSMSInput = z.infer<typeof sendSMSSchema>
export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
