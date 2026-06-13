/**
 * AI 对话验证 Schema (Zod)
 */
import { z } from 'zod'

// ChatMessage schema
const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant'], {
    error: '角色必须是 system/user/assistant 之一',
  }),
  content: z.string('消息内容不能为空')
    .max(10000, '单条消息最多10000个字符'),
})

// ============ 聊天 ============
export const chatSchema = z.object({
  messages: z.array(chatMessageSchema, 'messages 必须是消息数组')
    .min(1, '至少需要1条消息')
    .max(100, '最多100条消息'),
  dimensionId: z.string('dimensionId 不能为空')
    .max(50, 'dimensionId最多50个字符'),
})

// ============ 生成故事 ============
export const generateStorySchema = z.object({
  messages: z.array(chatMessageSchema, 'messages 必须是消息数组')
    .min(1, '至少需要1条消息')
    .max(100, '最多100条消息'),
})

export type ChatInput = z.infer<typeof chatSchema>
export type GenerateStoryInput = z.infer<typeof generateStorySchema>
