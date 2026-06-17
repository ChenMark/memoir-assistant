/**
 * Agent 对话记忆 — 持久化存储
 * 使用 Prisma 存储最近对话，支持跨会话记忆
 */
import { prisma } from './prisma.js'

interface StoredMessage {
  role: string
  content: string
  tool_calls?: unknown[]
  tool_call_id?: string
}

interface Conversation {
  id: string
  messages: StoredMessage[]
}

/**
 * 获取最近一次对话（或指定 ID 的对话）
 */
export async function getConversation(userId: string, conversationId?: string): Promise<Conversation | null> {
  const where = conversationId
    ? { userId, id: conversationId }
    : { userId }

  const conv = await prisma.agentConversation.findFirst({
    where,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, messages: true },
  })

  if (!conv) return null
  try {
    return { id: conv.id, messages: JSON.parse(conv.messages) }
  } catch {
    return null
  }
}

/**
 * 保存对话（复用已有会话或创建新会话）
 */
export async function saveConversation(
  userId: string,
  existingId: string | undefined,
  messages: StoredMessage[],
): Promise<string> {
  // 只保留最近 30 条消息，避免数据库膨胀
  const trimmed = messages.slice(-30)

  if (existingId) {
    await prisma.agentConversation.update({
      where: { id: existingId },
      data: { messages: JSON.stringify(trimmed) },
    })
    return existingId
  }

  const conv = await prisma.agentConversation.create({
    data: {
      userId,
      messages: JSON.stringify(trimmed),
    },
  })
  return conv.id
}
