/**
 * Agent 对话路由 — SSE 流式 + Function Calling + 对话记忆
 * 兼容 OpenAI Chat Completions API
 */
import { Router, Request, Response } from 'express'
import { authMiddleware } from './auth.js'
import { toolsToOpenAIFunctions, executeTool } from '../lib/agent-tools.js'
import { getConversation, saveConversation } from '../lib/conversation-store.js'

const router = Router()
router.use(authMiddleware)

function userId(req: Request): string {
  return (req as any).userId as string
}

const OPENAI_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || ''
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

const SYSTEM_PROMPT = `你是"忆往昔"回忆录助手的 AI Agent。你帮助老年用户记录人生故事、整理照片、管理家族关系。

## 你的能力
- 📝 创建/搜索/浏览回忆录
- 🖼️ 搜索/浏览相册照片
- 👥 管理亲友/家族成员
- ❤️ 记录金曲/电影/比赛
- 📊 查看用户数据统计

## 规则
1. 用温暖、耐心、口语化的语气交流，像晚辈和长辈聊天
2. 用户说"帮我记一下"→ 收集完整信息后创建回忆录
3. 用户说"找照片"→ 先用搜索，找不到再列出全部
4. 主动引导用户说更多细节："这张老照片背后有什么故事呀？"
5. 每次回复控制在2-3句话以内，简洁温暖
6. 优先用工具完成任务，不要空口说"我帮你记下来"
7. 如果用户问候闲聊，简单回复并引导使用功能`

/** POST /agent/chat — SSE 流式对话 */
router.post('/chat', async (req: Request, res: Response) => {
  const uid = userId(req)
  const { messages, conversationId } = req.body as { messages: ChatMessage[]; conversationId?: string }
  if (!messages?.length) {
    return res.status(400).json({ error: 'messages 不能为空' })
  }

  // 加载历史对话（最近 3 轮）
  const history = await getConversation(uid, conversationId)
  const savedCid = history?.id

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const send = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`)
  send({ type: 'meta', conversationId: savedCid })

  try {
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...((history?.messages || []).slice(-6) as ChatMessage[]),  // 最近3轮对话
      ...messages.slice(-10),
    ]

    // ===== Agent 循环：最多 5 轮 tool calling =====
    let round = 0
    while (round < 5) {
      round++

      const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: fullMessages,
          tools: toolsToOpenAIFunctions(),
          tool_choice: round === 1 ? 'auto' : 'auto',
          stream: false,
          max_tokens: 1000,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        send({ type: 'error', content: `AI 服务异常: ${response.status}` })
        console.error('[agent] OpenAI error:', err)
        break
      }

      const completion = await response.json()
      const choice = completion.choices?.[0]
      const msg = choice?.message

      if (!msg) {
        send({ type: 'error', content: 'AI 未返回有效响应' })
        break
      }

      // 有 tool calls → 执行工具
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          send({
            type: 'tool_call',
            name: tc.function.name,
            arguments: tc.function.arguments,
          })

          const result = await executeTool(
            tc.function.name,
            tc.function.arguments,
            uid,
          )

          fullMessages.push({ role: 'assistant', content: '', tool_calls: [tc] })
          fullMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          })

          send({ type: 'tool_result', name: tc.function.name, content: result })
        }
        continue // 继续循环，让 AI 基于工具结果回复
      }

      // 最终文本回复
      const finalContent = msg.content || ''
      send({ type: 'text', content: finalContent })
      
      // 保存对话记忆
      fullMessages.push({ role: 'assistant', content: finalContent })
      saveConversation(uid, savedCid, fullMessages.slice(1)).catch(() => {})
      break
    }

    if (round >= 5) {
      send({ type: 'text', content: '（处理步骤较多，如果需要继续请告诉我）' })
    }
  } catch (err) {
    send({ type: 'error', content: `Agent 异常: ${(err as Error).message}` })
  }

  send({ type: 'done' })
  res.end()
})

/** GET /agent/history/:id? — 加载历史对话 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const uid = userId(req)
    const conversationId = req.query.id as string | undefined
    const conv = await getConversation(uid, conversationId)
    res.json({ conversation: conv || null })
  } catch (err) {
    res.status(500).json({ error: `加载失败: ${(err as Error).message}` })
  }
})

/** POST /agent/tools — 获取可用工具列表（供前端展示） */
router.get('/tools', (_req: Request, res: Response) => {
  const tools = toolsToOpenAIFunctions()
  const simplified = tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
  }))
  res.json({ tools: simplified })
})

export default router
