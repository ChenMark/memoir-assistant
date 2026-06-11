import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDimensions, sendMessage, generateStory, ChatMessage, InterviewDimension } from '../utils/aiService'

export default function AIInterview() {
  const navigate = useNavigate()
  
  // =========== 状态管理 ===========
  const [dimensions, setDimensions] = useState<InterviewDimension[]>([])
  const [currentDimension, setCurrentDimension] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [storyDraft, setStoryDraft] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [phase, setPhase] = useState<'interview' | 'story'>('interview')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // =========== 初始化 ===========
  useEffect(() => {
    loadDimensions()
  }, [])

  // 滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadDimensions = async () => {
    try {
      const dims = await getDimensions()
      setDimensions(dims)
      if (dims.length > 0) {
        setCurrentDimension(dims[0].id)
        // 自动发送第一条引导消息
        startInterview(dims[0].id)
      }
    } catch (err: any) {
      alert(`加载引导维度失败：${err.message}`)
    }
  }

  const startInterview = async (dimensionId: string) => {
    setLoading(true)
    try {
      // 发送初始消息，获取 AI 的第一个问题
      const initialMessages: ChatMessage[] = [
        {
          role: 'system',
          content: '你是一位专业的回忆录撰写助手，通过对话引导用户回忆人生经历。',
        },
        {
          role: 'user',
          content: '开始采访',
        },
      ]
      
      const response = await sendMessage(initialMessages, dimensionId)
      
      setMessages([
        { role: 'assistant', content: response.reply },
      ])
      setPhase('interview')
      setStoryDraft('')
    } catch (err: any) {
      alert(`开始访谈失败：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // =========== 发送消息 ===========
  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await sendMessage(newMessages, currentDimension)
      
      const assistantMessage: ChatMessage = { role: 'assistant', content: response.reply }
      const updatedMessages = [...newMessages, assistantMessage]
      setMessages(updatedMessages)

      // 如果访谈完成，自动生成故事
      if (response.done) {
        handleGenerateStory(updatedMessages)
      }
    } catch (err: any) {
      alert(`发送消息失败：${err.message}`)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // =========== 生成故事 ===========
  const handleGenerateStory = async (msgs?: ChatMessage[]) => {
    const msgsToUse = msgs || messages
    if (msgsToUse.length === 0) return

    setGenerating(true)
    setPhase('story')
    try {
      const story = await generateStory(msgsToUse)
      setStoryDraft(story)
    } catch (err: any) {
      alert(`生成故事失败：${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  // =========== 切换维度 ===========
  const handleDimensionChange = (dimId: string) => {
    if (dimId === currentDimension) return
    setCurrentDimension(dimId)
    setMessages([])
    startInterview(dimId)
  }

  // =========== 保存草稿 ===========
  const handleSaveDraft = async () => {
    try {
      const token = localStorage.getItem('memoir_auth_token')
      const response = await fetch('/api/memoir/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: `AI访谈 - ${dimensions.find(d => d.id === currentDimension)?.name || '未命名'}`,
          content: storyDraft || messages.map(m => `${m.role}: ${m.content}`).join('\n\n'),
          tags: ['AI访谈', currentDimension],
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存失败')
      alert('草稿已保存！')
      navigate('/drafts')
    } catch (err: any) {
      alert(`保存草稿失败：${err.message}`)
    }
  }

  // =========== 渲染 ===========
  const currentDim = dimensions.find(d => d.id === currentDimension)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 20 }}>
      {/* 左侧：对话界面 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
        {/* 顶部：维度选择 */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {dimensions.map(dim => (
            <button
              key={dim.id}
              onClick={() => handleDimensionChange(dim.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: currentDimension === dim.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: currentDimension === dim.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: currentDimension === dim.id ? 'var(--primary)' : 'var(--text)',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: currentDimension === dim.id ? 600 : 400,
              }}
            >
              {dim.name}
            </button>
          ))}
        </div>

        {/* 消息列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: 16,
                  background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: 12, borderRadius: 16, background: 'var(--bg)', fontSize: 14 }}>
                AI 正在思考...
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的回答...（Shift+Enter 换行）"
            disabled={loading}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              border: '1px solid var(--border)',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'none',
              minHeight: 60,
              maxHeight: 120,
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              padding: '12px 24px',
              background: loading || !input.trim() ? '#94a3b8' : 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            发送
          </button>
        </div>
      </div>

      {/* 右侧：故事预览 */}
      <div style={{ width: 400, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}> 故事脉络</h3>
          <button
            onClick={() => handleGenerateStory()}
            disabled={generating || messages.length === 0}
            style={{
              padding: '6px 12px',
              background: generating ? '#94a3b8' : 'var(--success)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? '生成中...' : '✨ 生成故事'}
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {generating ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
              <div>AI 正在生成故事脉络...</div>
            </div>
          ) : storyDraft ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>
              {storyDraft}
            </pre>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              <div>与 AI 对话后，点击"生成故事"按钮</div>
              <div style={{ marginTop: 8, fontSize: 12 }}>AI 会根据访谈内容整理成故事脉络</div>
            </div>
          )}
        </div>

        {/* 保存按钮 */}
        {(storyDraft || messages.length > 0) && (
          <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleSaveDraft}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              💾 保存草稿
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
