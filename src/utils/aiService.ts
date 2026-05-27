/**
 * AI 服务层 - 前端
 * 调用后端 AI API，处理访谈对话和故事生成
 */

// ============ 类型定义 ===========

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface InterviewDimension {
  id: string
  name: string
  description: string
  prompts: string[]
}

export interface ChatResponse {
  reply: string
  done: boolean
}

// ============ API 调用 ===========

const BASE_URL = '/ai' // 通过 Vite 代理到后端

/**
 * 获取引导维度列表
 */
export async function getDimensions(): Promise<InterviewDimension[]> {
  const res = await fetch(`${BASE_URL}/dimensions`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '获取维度失败')
  return json.data
}

/**
 * 发送聊天消息，获取 AI 响应
 */
export async function sendMessage(
  messages: ChatMessage[],
  dimensionId: string
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, dimensionId }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '发送消息失败')
  return json.data
}

/**
 * 根据访谈记录生成故事脉络
 */
export async function generateStory(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${BASE_URL}/generate-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '生成故事失败')
  return json.data.story
}
