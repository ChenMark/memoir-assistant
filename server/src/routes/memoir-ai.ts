/**
 * 回忆录 AI 增强
 * POST /memoir/:id/polish     AI 润色（口语→书面）
 * POST /memoir/from-photos    从照片生成回忆录
 * POST /memoir/from-voice     从语音转写生成回忆录
 * POST /memoir/:id/voice      TTS 朗读（返回音频 URL）
 * POST /memoir/template       从模板创建草稿
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'
import { generateText } from '../lib/ai.js'
import { generateUploadUrl, generateDownloadUrl } from '../lib/oss.js'

const router = Router({ mergeParams: true })
router.use(authMiddleware)

const polishSchema = z.object({
  style: z.enum(['literary', 'plain', 'warm']).default('literary'),
})

// POST /memoir/:id/polish
router.post('/:id/polish', async (req, res) => {
  const uid = userId(req)
  const parse = polishSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const memoir = await prisma.memoir.findFirst({ where: { id: (req.params as any).id, userId: uid } })
  if (!memoir) return res.status(404).json({ error: '回忆录不存在' })

  const styleMap = {
    literary: '将以下口语化文本润色为优美、富有文学性的回忆录段落。保留原始事件和情感，只改善表达。',
    plain: '将以下文本整理为通顺、朴实的回忆录。修正错别字，保留原意。',
    warm: '将以下文本润色为温暖、感人的家庭回忆录风格。',
  }
  const prompt = `${styleMap[parse.data.style]}字数控制在原文 1.5 倍以内。

原文：
${memoir.content}

输出润色后的纯文本（不带任何前缀）：`

  const polished = await generateText(prompt)
  res.json({ original: memoir.content, polished, style: parse.data.style })
})

const fromPhotosSchema = z.object({
  ossKeys: z.array(z.string()).min(1).max(20),
  title: z.string().optional(),
  style: z.enum(['narrative', 'poem', 'letter']).default('narrative'),
})

// POST /memoir/from-photos
router.post('/from-photos', async (req, res) => {
  const uid = userId(req)
  const parse = fromPhotosSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })

  // ✅ S1 修复：ossKey 必须以用户专属前缀开头，防止跨用户访问
  //    用户专属路径约定: uploads/{userId}/...
  const userPrefix = `uploads/${uid}/`
  const validatedKeys = parse.data.ossKeys.filter((k) => k.startsWith(userPrefix))

  if (validatedKeys.length === 0) {
    return res.status(400).json({ error: '照片 key 无效或不属于当前用户' })
  }

  // 加载照片元数据
  const photos = await prisma.gallery.findMany({
    where: { userId: uid, ossKey: { in: validatedKeys } },
  })

  const captions = photos.map((p, i) => `${i + 1}. ${p.caption || '一张照片'}（${p.date}）`).join('\n')
  const styleMap = {
    narrative: '叙述风格',
    poem: '诗歌风格',
    letter: '书信风格',
  }
  const prompt = `根据以下照片描述，撰写一段 ${styleMap[parse.data.style]} 的回忆录。
标题建议：${parse.data.title || '由您提供'}

照片：
${captions}

要求：300-500 字，开头直接进入场景，结尾留有情感共鸣。`

  const content = await generateText(prompt)

  // 创建草稿
  const memoir = await prisma.memoir.create({
    data: {
      userId: uid,
      title: parse.data.title || '照片回忆录',
      content: content || '请填写内容',
      date: photos[0]?.date || new Date().toISOString().slice(0, 10),
      tags: JSON.stringify(['AI生成', '照片']),
      mood: 'sentimental',
      media: JSON.stringify(validatedKeys),  // ✅ 仅保存已校验的 key
    },
  })
  res.json({ memoir })
})

const fromVoiceSchema = z.object({
  transcript: z.string().min(10),
  title: z.string().optional(),
})

// POST /memoir/from-voice
router.post('/from-voice', async (req, res) => {
  const uid = userId(req)
  const parse = fromVoiceSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })

  const prompt = `将以下口述文字整理为结构化回忆录（200-400 字），保留所有关键事件和情感：

口述：
${parse.data.transcript}

输出整理后的纯文本：`

  const content = await generateText(prompt)
  const memoir = await prisma.memoir.create({
    data: {
      userId: uid,
      title: parse.data.title || '口述回忆录',
      content: content || parse.data.transcript,
      date: new Date().toISOString().slice(0, 10),
      tags: JSON.stringify(['口述', 'AI整理']),
      mood: 'sentimental',
      media: '[]',
    },
  })
  res.json({ memoir })
})

// 模板库
const TEMPLATES = [
  {
    id: 'first-job',
    title: '第一次工作',
    prompts: [
      '您的第一份工作是什么？在哪里？',
      '还记得第一天上班的情景吗？',
      '当时您的师傅/同事是什么样的人？',
      '最难忘的一段工作经历？',
    ],
  },
  {
    id: 'meet-spouse',
    title: '遇见爱人',
    prompts: [
      '您和爱人是怎么认识的？',
      '第一次见面您记得最深的是什么？',
      '求婚前你们经历过什么难忘的事？',
      '结婚那天是什么样的？',
    ],
  },
  {
    id: 'childhood',
    title: '童年记忆',
    prompts: [
      '童年住在哪里？家里几口人？',
      '小时候最喜欢玩什么游戏？',
      '最疼您的人是谁？',
      '童年最让你难忘的一件事？',
    ],
  },
  {
    id: 'parent',
    title: '我的父母',
    prompts: [
      '父母年轻时是做什么的？',
      '父亲/母亲最让您敬佩的一点？',
      '小时候父母教您最深刻的一句话？',
      '想对父母说却没说出口的话？',
    ],
  },
  {
    id: 'best-friend',
    title: '挚友',
    prompts: [
      '你们是怎么成为朋友的？',
      '你们一起做过最疯狂的事？',
      '对方帮过您最大的忙是什么？',
      '现在还保持联系吗？',
    ],
  },
]

// GET /memoir/templates
router.get('/templates', (_req, res) => {
  res.json({ items: TEMPLATES })
})

// POST /memoir/template
const templateSchema = z.object({
  templateId: z.string(),
  answers: z.array(z.string()),
})
router.post('/template', async (req, res) => {
  const uid = userId(req)
  const parse = templateSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const tpl = TEMPLATES.find((t) => t.id === parse.data.templateId)
  if (!tpl) return res.status(404).json({ error: '模板不存在' })

  const combined = tpl.prompts
    .map((p, i) => `${p}\n答案：${parse.data.answers[i] || '（未填写）'}`)
    .join('\n\n')

  const prompt = `根据以下问答，生成一篇结构化回忆录。

模板：${tpl.title}

问答：
${combined}

输出格式：
标题：[回忆录标题]
正文：[300-500 字正文]`

  const text = await generateText(prompt)
  const [titleLine, ...rest] = text.split('\n')
  const title = titleLine?.replace(/^标题[:：]\s*/, '').trim() || tpl.title
  const content = rest.join('\n').replace(/^正文[:：]\s*/, '').trim()

  const memoir = await prisma.memoir.create({
    data: {
      userId: uid,
      title,
      content: content || '请填写',
      date: new Date().toISOString().slice(0, 10),
      tags: JSON.stringify([tpl.title, '模板']),
      mood: 'happy',
      media: '[]',
    },
  })
  res.json({ memoir, template: tpl })
})

// 复制回忆录
router.post('/:id/duplicate', async (req, res) => {
  const uid = userId(req)
  const original = await prisma.memoir.findFirst({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (!original) return res.status(404).json({ error: '回忆录不存在' })

  const copy = await prisma.memoir.create({
    data: {
      userId: uid,
      title: `${original.title}（副本）`,
      content: original.content,
      date: original.date,
      tags: original.tags,
      mood: original.mood,
      media: original.media,
      isPublished: false,
    },
  })
  res.json({ memoir: copy })
})

export default router
