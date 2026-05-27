/**
 * AI 访谈 API 路由
 * 处理 AI 对话引导相关的 API 请求
 */

import { Router, Request, Response } from 'express'
import {
  chat,
  generateStory,
  getDimensions,
  ChatMessage,
} from '../lib/ai'

const router = Router()

// =========== 获取引导维度列表 ===========

router.get('/dimensions', async (req: Request, res: Response) => {
  try {
    const dimensions = getDimensions()
    res.json({ success: true, data: dimensions })
  } catch (error: any) {
    console.error('[AI] 获取维度失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// =========== 发送聊天消息 ===========

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, dimensionId } = req.body

    // 验证参数
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'messages 必须是数组' })
    }
    if (!dimensionId || typeof dimensionId !== 'string') {
      return res.status(400).json({ success: false, error: 'dimensionId 必须是字符串' })
    }

    // 调用 AI 服务
    const result = await chat(messages as ChatMessage[], dimensionId)

    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[AI] 聊天失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// =========== 生成故事脉络 ===========

router.post('/generate-story', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body

    // 验证参数
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'messages 必须是数组' })
    }

    // 调用 AI 服务生成故事
    const story = await generateStory(messages as ChatMessage[])

    res.json({ success: true, data: { story } })
  } catch (error: any) {
    console.error('[AI] 生成故事失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
