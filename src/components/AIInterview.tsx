import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDimensions, sendMessage, generateStory, ChatMessage, InterviewDimension } from '../utils/aiService'
import jsPDF from 'jspdf'

export default function AIInterview() {
  const navigate = useNavigate()
  
  // =========== 状态管理 ===========
  const [dimensions, setDimensions] = useState<InterviewDimension[]>([])
  const [currentDimension, setCurrentDimension] = useState<string>(() => {
    try {
      return localStorage.getItem('memoir_interview_dimension') || ''
    } catch {
      return ''
    }
  })
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // 从 localStorage 恢复对话记录（按维度分开存储）
    try {
      const savedDimId = localStorage.getItem('memoir_interview_dimension')
      const key = savedDimId ? `memoir_interview_messages_${savedDimId}` : 'memoir_interview_messages'
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [storyDraft, setStoryDraft] = useState<string>(() => {
    // 从 localStorage 恢复故事草稿（按维度分开存储）
    try {
      const savedDimId = localStorage.getItem('memoir_interview_dimension')
      const key = savedDimId ? `memoir_interview_story_${savedDimId}` : 'memoir_interview_story'
      return localStorage.getItem(key) || ''
    } catch {
      return ''
    }
  })
  const [generating, setGenerating] = useState(false)
  const [phase, setPhase] = useState<'interview' | 'story'>(() => {
    // 从 localStorage 恢复阶段（按维度分开存储）
    try {
      const savedDimId = localStorage.getItem('memoir_interview_dimension')
      const key = savedDimId ? `memoir_interview_phase_${savedDimId}` : 'memoir_interview_phase'
      return (localStorage.getItem(key) as 'interview' | 'story') || 'interview'
    } catch {
      return 'interview'
    }
  })
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // =========== 自动保存对话到 localStorage ===========
  useEffect(() => {
    try {
      const key = currentDimension ? `memoir_interview_messages_${currentDimension}` : 'memoir_interview_messages'
      localStorage.setItem(key, JSON.stringify(messages))
    } catch {}
  }, [messages, currentDimension])

  useEffect(() => {
    try { localStorage.setItem('memoir_interview_dimension', currentDimension) } catch {}
  }, [currentDimension])

  useEffect(() => {
    try {
      const key = currentDimension ? `memoir_interview_story_${currentDimension}` : 'memoir_interview_story'
      localStorage.setItem(key, storyDraft)
    } catch {}
  }, [storyDraft, currentDimension])

  useEffect(() => {
    try {
      const key = currentDimension ? `memoir_interview_phase_${currentDimension}` : 'memoir_interview_phase'
      localStorage.setItem(key, phase)
    } catch {}
  }, [phase, currentDimension])

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
      
      // 检查是否有已保存的对话（从 localStorage 恢复）
      const savedDimId = localStorage.getItem('memoir_interview_dimension')
      const messagesKey = savedDimId ? `memoir_interview_messages_${savedDimId}` : 'memoir_interview_messages'
      const savedMessagesRaw = localStorage.getItem(messagesKey)
      let hasSavedMessages = false
      try { hasSavedMessages = savedMessagesRaw ? JSON.parse(savedMessagesRaw).length > 0 : false } catch {}
      
      if (hasSavedMessages) {
        // 有已保存的对话，恢复维度而不开始新访谈
        if (savedDimId && dims.find(d => d.id === savedDimId)) {
          setCurrentDimension(savedDimId)
        } else if (dims.length > 0) {
          setCurrentDimension(dims[0].id)
        }
        // 不调用 startInterview，保留已保存的消息
      } else if (dims.length > 0) {
        // 没有已保存的对话，开始新访谈
        setCurrentDimension(dims[0].id)
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
    // 尝试从 localStorage 恢复该维度的对话
    try {
      const key = `memoir_interview_messages_${dimId}`
      const saved = localStorage.getItem(key)
      if (saved && JSON.parse(saved).length > 0) {
        // 有已保存的对话，恢复而不开始新访谈
        const savedMessages = JSON.parse(saved)
        setMessages(savedMessages)
        const storyKey = `memoir_interview_story_${dimId}`
        const savedStory = localStorage.getItem(storyKey) || ''
        setStoryDraft(savedStory)
        const phaseKey = `memoir_interview_phase_${dimId}`
        const savedPhase = localStorage.getItem(phaseKey) || 'interview'
        setPhase(savedPhase as 'interview' | 'story')
        return
      }
    } catch {}
    // 没有已保存的对话，开始新访谈
    setMessages([])
    setStoryDraft('')
    setPhase('interview')
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

  // =========== 导出功能 ===========

  const handleExportWord = () => {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>回忆录</title>
      <style>
        body { font-family: 'SimSun', '宋体', serif; line-height: 1.8; max-width: 800px; margin: 40px auto; padding: 20px; }
        h1 { color: #2d3748; border-bottom: 2px solid #b8860b; padding-bottom: 10px; }
        h2 { color: #4a5568; margin-top: 30px; }
        p { margin: 10px 0; }
      </style></head>
      <body>${storyDraft.replace(/\n/g, '<br>')}</body></html>`
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `回忆录_${new Date().toISOString().slice(0, 10)}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF()
      
      // 设置中文字体（使用系统字体）
      doc.setFont('helvetica')
      
      // 解析markdown内容
      const lines = storyDraft.split('\n')
      let yPosition = 20
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 20
      const maxWidth = pageWidth - 2 * margin
      
      // 添加标题
      doc.setFontSize(20)
      doc.text('我的回忆录', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 15
      
      // 添加分割线
      doc.setDrawColor(184, 134, 11) // #b8860b
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10
      
      // 添加日期
      doc.setFontSize(10)
      doc.setTextColor(120, 120, 120)
      doc.text(`生成日期: ${new Date().toLocaleDateString('zh-CN')}`, margin, yPosition)
      yPosition += 15
      doc.setTextColor(0, 0, 0)
      
      // 处理内容
      doc.setFontSize(12)
      for (const line of lines) {
        if (line.startsWith('# ')) {
          // 一级标题
          doc.setFontSize(16)
          doc.setFont('helvetica', 'bold')
          const text = line.substring(2)
          const splitText = doc.splitTextToSize(text, maxWidth)
          doc.text(splitText, margin, yPosition)
          yPosition += splitText.length * 7 + 5
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(12)
        } else if (line.startsWith('## ')) {
          // 二级标题
          doc.setFontSize(14)
          doc.setFont('helvetica', 'bold')
          const text = line.substring(3)
          const splitText = doc.splitTextToSize(text, maxWidth)
          doc.text(splitText, margin, yPosition)
          yPosition += splitText.length * 6 + 5
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(12)
        } else if (line.startsWith('### ')) {
          // 三级标题
          doc.setFontSize(13)
          doc.setFont('helvetica', 'bold')
          const text = line.substring(4)
          const splitText = doc.splitTextToSize(text, maxWidth)
          doc.text(splitText, margin, yPosition)
          yPosition += splitText.length * 5 + 3
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(12)
        } else if (line.startsWith('> ')) {
          // 引用
          doc.setFontSize(11)
          doc.setTextColor(100, 100, 100)
          const text = line.substring(2)
          const splitText = doc.splitTextToSize(text, maxWidth - 10)
          doc.text(splitText, margin + 5, yPosition)
          yPosition += splitText.length * 5 + 3
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(12)
        } else if (line.trim() === '---') {
          // 分割线
          doc.setDrawColor(200, 200, 200)
          doc.line(margin, yPosition, pageWidth - margin, yPosition)
          yPosition += 10
        } else if (line.trim() === '') {
          // 空行
          yPosition += 5
        } else {
          // 普通段落
          const text = line.replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
          const splitText = doc.splitTextToSize(text, maxWidth)
          
          // 检查是否需要换页
          if (yPosition + splitText.length * 5 > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage()
            yPosition = margin
          }
          
          doc.text(splitText, margin, yPosition)
          yPosition += splitText.length * 5 + 3
        }
        
        // 检查页面边界
        if (yPosition > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage()
          yPosition = margin
        }
      }
      
      // 保存PDF
      doc.save(`回忆录_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err: any) {
      alert(`导出PDF失败: ${err.message}`)
    }
  }

  // =========== 渲染 ===========
  const currentDim = dimensions.find(d => d.id === currentDimension)
  const completedCount = dimensions.filter(d => {
    try {
      const key = `memoir_interview_messages_${d.id}`
      const saved = localStorage.getItem(key)
      return saved && JSON.parse(saved).length > 2
    } catch { return false }
  }).length

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 20 }}>
      {/* 左侧：对话界面 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
        {/* 顶部：阶段选择 + 进度 */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>📋 选择访谈话题</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              已聊 {completedCount}/{dimensions.length} 个话题
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
            {dimensions.map(dim => {
              const hasChat = (() => {
                try {
                  const key = `memoir_interview_messages_${dim.id}`
                  const saved = localStorage.getItem(key)
                  return saved && JSON.parse(saved).length > 2
                } catch { return false }
              })()
              return (
                <button
                  key={dim.id}
                  onClick={() => handleDimensionChange(dim.id)}
                  title={dim.description}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: currentDimension === dim.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: currentDimension === dim.id ? 'rgba(99,102,241,0.08)' : hasChat ? 'rgba(34,197,94,0.06)' : 'transparent',
                    color: currentDimension === dim.id ? 'var(--primary)' : 'var(--text)',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: currentDimension === dim.id ? 600 : 400,
                    textAlign: 'center',
                    transition: 'all 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <span>{dim.name}</span>
                  {hasChat && <span style={{ fontSize: 10, color: '#22c55e' }}>● 已聊</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* 提示词面板 */}
        {currentDim && (
          <div style={{
            padding: '10px 16px',
            background: 'rgba(99,102,241,0.04)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            flexWrap: 'nowrap',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, fontWeight: 600 }}>💡 参考：</span>
            {currentDim.prompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => { setInput(prompt) }}
                title="点击填入输入框"
                style={{
                  padding: '4px 12px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: '#fff',
                  color: 'var(--text)',
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--primary)'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = 'var(--primary)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                {prompt.length > 18 ? prompt.slice(0, 18) + '…' : prompt}
              </button>
            ))}
          </div>
        )}

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
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}> 故事脉络</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          {storyDraft && (
            <>
              <button
                onClick={handleExportWord}
                style={{
                  padding: '6px 12px',
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                📄 导出Word
              </button>
              <button
                onClick={handleExportPDF}
                style={{
                  padding: '6px 12px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                📕 导出PDF
              </button>
            </>
          )}
          </div>
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
