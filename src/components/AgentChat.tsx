/**
 * 忆往昔 Agent 对话组件
 * SSE 流式通信 + 工具调用可视化
 */
import { useState, useRef, useEffect, useCallback } from 'react'

interface ChatBubble {
  id: string
  role: 'user' | 'agent' | 'tool'
  content: string
  toolName?: string
}

const WELCOME_MSG = '👋 您好！我是忆往昔助手。可以帮您记回忆录、找照片、管亲友、录爱好。试试说"帮我记一段回忆"或"看看我的照片"吧！'

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatBubble[]>([
    { id: 'welcome', role: 'agent', content: WELCOME_MSG },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tools, setTools] = useState<Array<{ name: string; description: string }>>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // 保存 conversationId 用于跨轮次记忆
  const conversationIdRef = useRef<string | undefined>(undefined)

  // 首次挂载时尝试加载最近一次对话
  useEffect(() => {
    const token = localStorage.getItem('memoir_auth_token')
    if (!token) return
    fetch('/api/v1/agent/history', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.conversation) {
          conversationIdRef.current = d.conversation.id
          const restored: ChatBubble[] = d.conversation.messages
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any, i: number) => ({
              id: `r_${i}`,
              role: m.role === 'assistant' ? 'agent' : 'user',
              content: m.content || '',
            }))
          setMessages([{ id: 'welcome', role: 'agent', content: WELCOME_MSG }, ...restored])
        }
      })
      .catch(() => {})
  }, [])

  // 加载工具列表
  useEffect(() => {
    const token = localStorage.getItem('memoir_auth_token')
    fetch('/api/v1/agent/tools', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setTools(d.tools || []))
      .catch(() => {})
  }, [])

  // MEDIUM-13: 用 ref 追踪最新 messages，避免回调依赖整个数组
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)

    const userBubble: ChatBubble = { id: `u_${Date.now()}`, role: 'user', content: text }
    const agentBubble: ChatBubble = { id: `a_${Date.now()}`, role: 'agent', content: '' }
    setMessages((prev) => [...prev, userBubble, agentBubble])

    try {
      const token = localStorage.getItem('memoir_auth_token')
      // MEDIUM-14: 保留完整历史结构（role + content + tool_call_id）
      const history = messagesRef.current
        .filter((m) => m.role !== 'tool')
        .slice(-10)
        .map((m) => ({
          role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: m.content,
        }))

      const res = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: text }],
          conversationId: conversationIdRef.current,
        }),
      })

      if (res.status === 429) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentBubble.id
              ? { ...m, content: '⏳ 请求过于频繁，请稍等一分钟再试' }
              : m,
          ),
        )
        return
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentBubble.id ? { ...m, content: m.content + event.content } : m,
                ),
              )
            } else if (event.type === 'tool_call') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentBubble.id
                    ? { ...m, content: m.content + `\n🔧 正在执行: ${event.name}...` }
                    : m,
                ),
              )
            } else if (event.type === 'tool_result') {
              setMessages((prev) => [
                ...prev,
                { id: `t_${Date.now()}`, role: 'tool', content: event.content, toolName: event.name },
              ])
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentBubble.id ? { ...m, content: `❌ ${event.content}` } : m,
                ),
              )
            } else if (event.type === 'meta' && event.conversationId) {
              // HIGH-3: 持久化 conversationId
              conversationIdRef.current = event.conversationId as string
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentBubble.id
            ? { ...m, content: `❌ 连接失败: ${(err as Error).message}` }
            : m,
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 0' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>🤖 忆往昔 Agent</h2>

      {/* 对话区 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: 16, height: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: m.role === 'tool' ? '100%' : '80%',
              background: m.role === 'user' ? 'var(--primary)' : m.role === 'tool' ? '#f0fdf4' : '#f8f9fa',
              color: m.role === 'user' ? '#fff' : m.role === 'tool' ? '#166534' : 'var(--text)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              borderLeft: m.role === 'tool' ? '3px solid #22c55e' : 'none',
            }}>
              {m.role === 'tool' && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>🔧 {m.toolName} → </span>}
              {m.content || (m.role === 'agent' && loading && '...')}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 输入区 */}
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }}
            placeholder="告诉我您想做什么..."
            aria-label="Agent 对话输入"
            disabled={loading}
            style={{
              flex: 1, padding: '10px 14px', border: '1px solid var(--border)',
              borderRadius: 10, fontSize: 14,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              padding: '10px 20px', background: loading || !input.trim() ? '#ccc' : 'var(--primary)',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer',
            }}
          >发送</button>
        </div>
      </div>

      {/* 能力标签 */}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tools.slice(0, 8).map((t) => (
          <button
            key={t.name}
            onClick={() => { setInput(t.description); setTimeout(() => sendMessage(), 100) }}
            style={{
              padding: '4px 12px', background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16,
              fontSize: 12, color: 'var(--primary)', cursor: 'pointer',
            }}
          >{t.description}</button>
        ))}
      </div>
    </div>
  )
}
