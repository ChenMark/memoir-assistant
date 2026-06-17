/**
 * Agent 路由 — SSE 流式 + Function Calling + 对话记忆
 * 兼容 OpenAI Chat Completions API
 */
import { Router, Request, Response } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { toolsToOpenAIFunctions, executeTool } from '../lib/agent-tools.js'
import { getConversation, saveConversation } from '../lib/conversation-store.js'

// 注意：authMiddleware 在 index.ts 已挂载，此处不重复
const router = Router()

// OpenAI Chat Completions 响应类型
interface OpenAICompletion {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
}

// HIGH-1: Agent 专用限流器（防资损 + 防 DoS）
// AI 请求按 token 计费，每用户每分钟 10 次
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'AI 对话过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  // 使用 IP keyGenerator helper（兼容 IPv6）
  keyGenerator: (req) => {
    const uid = (req as any).userId
    return uid ? `user:${uid}` : `ip:${ipKeyGenerator(req.ip || '')}`
  },
})
router.use(agentLimiter)

function userId(req: Request): string {
  return (req as any).userId as string
}

const OPENAI_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || ''
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
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
- 📊 查看用户数据统计和近期活动
- 🔍 全局智能搜索（照片+回忆录+爱好+亲友）

## 规则
1. 用温暖、耐心、口语化的语气交流，像晚辈和长辈聊天
2. 用户说"帮我记一下"→ 收集完整信息后创建回忆录
3. 用户说"找一下"或"帮我查查"时 → 先用 smart_search 全局搜索
4. 主动引导用户说更多细节："这张老照片背后有什么故事呀？"
5. 每次回复控制在2-3句话以内，简洁温暖
6. 根据用户近期活动主动建议：拍了新照片→提醒写故事
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
  // HIGH-3: 保留 existingCid 用于后续 saveConversation
  // - 有 conversationId 但找不到 → 当作新会话（create）
  // - 有 conversationId 且找到 → 复用 update
  // - 无 conversationId → 取最近一条，没有则新创建
  const existingCid: string | undefined = history?.id

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const send = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  // HIGH-3: 用变量追踪本次会话的最终 ID，新会话结束后会有值
  let finalCid: string | undefined = existingCid
  send({ type: 'meta', conversationId: finalCid })

  try {
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...((history?.messages || []) as ChatMessage[]).slice(-6),  // 最近3轮对话
      ...messages.slice(-10),
    ]

    // ===== Agent 循环：最多 5 轮 tool calling =====
    let round = 0
    let finalAssistantContent: string | null = null

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
          tool_choice: 'auto',
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

      const completion = await response.json() as OpenAICompletion
      const choice = completion.choices?.[0]
      const msg = choice?.message

      if (!msg) {
        send({ type: 'error', content: 'AI 未返回有效响应' })
        break
      }

      // 有 tool calls → 执行工具
      if (msg.tool_calls?.length) {
        // HIGH-2: 完整推回 assistant 消息（包含 tool_calls 字段）
        // OpenAI 协议要求下一轮对话中 assistant 消息必须带 tool_calls
        fullMessages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls,
        })

        // HIGH-8: 并行执行所有 tool_calls
        const toolExecutions = await Promise.all(
          msg.tool_calls.map(async (tc: NonNullable<typeof msg.tool_calls>[number]) => {
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

            send({ type: 'tool_result', name: tc.function.name, content: result })

            return { tc, result }
          }),
        )

        // 把工具结果推入上下文（顺序：每个 tc 对应一个 tool message）
        for (const { tc, result } of toolExecutions) {
          fullMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          })
        }
        continue // 继续循环，让 AI 基于工具结果回复
      }

      // 最终文本回复
      finalAssistantContent = msg.content || ''
      send({ type: 'text', content: finalAssistantContent })

      // 保存到上下文，供后续 saveConversation
      fullMessages.push({ role: 'assistant', content: finalAssistantContent })
      break
    }

    if (round >= 5) {
      send({ type: 'text', content: '（处理步骤较多，如果需要继续请告诉我）' })
    }

    // HIGH-3: 保存对话记忆（await 而不是 fire-and-forget，确保 ID 回传）
    if (finalAssistantContent !== null || fullMessages.some((m) => m.role === 'tool')) {
      try {
        const persistedCid = await saveConversation(
          uid,
          existingCid,
          fullMessages.slice(1) as any,  // 去掉 system 提示
        )
        finalCid = persistedCid
        send({ type: 'meta', conversationId: finalCid })
      } catch (err) {
        console.error('[agent] saveConversation failed:', err)
      }
    }
  } catch (err) {
    send({ type: 'error', content: `Agent 异常: ${(err as Error).message}` })
  }

  send({ type: 'done' })
  res.end()
})

/** GET /agent/history — 加载历史对话 */
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

/** GET /agent/tools — 获取可用工具列表（供前端展示） */
router.get('/tools', (_req: Request, res: Response) => {
  const tools = toolsToOpenAIFunctions()
  const simplified = tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
  }))
  res.json({ tools: simplified })
})

export default router
