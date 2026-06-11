/**
 * AI 服务库 - 回忆录引导对话
 * 优先使用免费 API（GitHub Models / HuggingFace），全部失败时降级到智能 Mock
 */

// ============ 类型定义 ============

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

export interface InterviewState {
  currentDimension: string
  completedDimensions: string[]
  messages: ChatMessage[]
  storyDraft: string
}

// ============ 引导维度定义 ============

export const INTERVIEW_DIMENSIONS: InterviewDimension[] = [
  {
    id: 'childhood',
    name: '童年时光',
    description: '引导用户回忆童年时期的经历、玩伴、家庭环境',
    prompts: [
      '你最早的记忆是什么？能跟我讲讲吗？',
      '小时候你最喜欢玩什么游戏？跟谁一起玩？',
      '你的家庭当时是什么样子？父母做什么工作？',
      '小时候你住在哪里？那个地方有什么特别的记忆？',
      '上学后，你最喜欢哪个老师？为什么？',
    ],
  },
  {
    id: 'youth',
    name: '青春岁月',
    description: '引导用户回忆青少年时期的学习、友情、梦想',
    prompts: [
      '青少年时期你有什么特别的梦想吗？',
      '那时候你最好的朋友是谁？你们一起做过什么有趣的事？',
      '你参加过什么课外活动或社团吗？',
      '有没有哪件事让你觉得自己"长大了"？',
      '那时候你喜欢什么样的音乐、电影或书籍？',
    ],
  },
  {
    id: 'career',
    name: '职场经历',
    description: '引导用户回忆工作经历、重要项目、同事关系',
    prompts: [
      '你的第一份工作是什么？当时是什么感觉？',
      '职业生涯中，哪个项目让你最有成就感？',
      '有没有哪位同事或上司对你影响很大？',
      '你换过几次工作？每次换工作的原因是什么？',
      '工作中遇到过什么特别大的挑战吗？怎么克服的？',
    ],
  },
  {
    id: 'friends',
    name: '重要朋友',
    description: '引导用户回忆生命中的重要朋友、合作伙伴',
    prompts: [
      '你生命中有哪些朋友对你影响很深？',
      '有没有一个朋友，你们的故事可以写一本书？',
      '你有没有经历过"患难见真情"的时刻？',
      '哪个朋友最了解你？你们怎么认识的？',
      '如果有机会，你想对哪位朋友说声"谢谢"？',
    ],
  },
  {
    id: 'family',
    name: '亲人故事',
    description: '引导用户回忆父母、兄弟姐妹、祖辈的故事',
    prompts: [
      '能跟我讲讲你父母的故事吗？他们是怎么认识的？',
      '你的祖辈有什么特别的故事吗？',
      '家里有没有什么传承下来的故事或家风？',
      '你和兄弟姐妹之间有什么难忘的回忆？',
      '如果有机会对已经离开的亲人说一句话，你会说什么？',
    ],
  },
  {
    id: 'life',
    name: '人生感悟',
    description: '引导用户回忆人生中的重要时刻、价值观、遗憾与满足',
    prompts: [
      '回首这一生，哪个时刻让你觉得最骄傲？',
      '有没有什么遗憾，现在想起来还会感慨？',
      '你觉得这一生最重要的是什么？',
      '如果可以重来，你会做哪些不同的选择？',
      '你想给年轻时的自己什么建议？',
    ],
  },
]

// ============ 系统提示词（核心）================

const SYSTEM_PROMPT = `你是一位温柔、耐心、善于倾听的回忆录引导师。你的任务是通过对话引导用户讲述他们的人生故事。

## 你的风格
- 语气温暖、自然，像一位老朋友在促膝长谈
- 每次只问一个问题，不要一次性问多个问题
- 认真倾听用户的回答，根据他们的回答继续深入，而不是机械地切换话题
- 当用户提到某个有趣的点时，主动追问细节："能再多说一点吗？"、"那时候你是什么感觉？"
- 如果用户向你提问（比如"你知道XXX吗"），先简短回答或表示认同，再自然地把话题引回用户的经历

## 当前话题
我们正在聊的话题是：{dimensionName}
这个话题的方向是：{dimensionDesc}

## 重要规则
- 不要在用户还在讲述时就急于切换到下一个话题
- 只有当用户明确说"好了"、"下一个"、"换个话题"时，才考虑结束当前话题
- 如果用户说"童年时光才刚刚开始"，你要道歉并继续深入童年话题
- 用第一人称"我"来称呼自己
- 回复要简洁（不超过80字），让用户多说，你少说

现在，请根据对话历史，给出你的下一句回复。`

// ============ 免费 API 调用（优先）================

/**
 * 尝试调用 GitHub Models API（免费，需 GitHub Token）
 */
async function callGitHubModels(
  messages: { role: string; content: string }[],
  dimensionName: string,
  dimensionDesc: string
): Promise<string> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN not set')

  const systemMsg = {
    role: 'system',
    content: SYSTEM_PROMPT.replace('{dimensionName}', dimensionName).replace('{dimensionDesc}', dimensionDesc),
  }

  const response = await fetch('https://models.inference.ai.azure.com/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-ms-model': 'gpt-4o-mini',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [systemMsg, ...messages],
      temperature: 0.8,
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`GitHub Models: ${response.status} ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || '嗯，我在听，你继续说。'
}

/**
 * 尝试调用 HuggingFace 免费 Inference API
 */
async function callHuggingFace(
  messages: { role: string; content: string }[],
  dimensionName: string,
  dimensionDesc: string
): Promise<string> {
  // 用 Qwen2.5 中文模型（HF 免费 Inference）
  const response = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: `[INST] ${SYSTEM_PROMPT.replace('{dimensionName}', dimensionName).replace('{dimensionDesc}', dimensionDesc)} [/INST]\n\n${messages.slice(-3).map(m => m.content).join('\n')}`,
      parameters: { max_new_tokens: 200, temperature: 0.8 },
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace: ${response.status} ${err}`)
  }

  const data = await response.json()
  const reply = Array.isArray(data) ? data[0]?.generated_text : data.generated_text
  return reply || '嗯，我在听。'
}

// ============ 智能 Mock（最终降级）================

/**
 * 智能 Mock：根据关键词生成上下文相关的回复
 */
function generateSmartMockReply(
  userMessage: string,
  messages: ChatMessage[],
  dimensionId: string
): string {
  const userLower = userMessage.toLowerCase()
  const assistantMsgCount = messages.filter(m => m.role === 'assistant').length

  // 用户向你提问
  if (userLower.includes('你知道') || userLower.includes('你了解') || userLower.includes('你清楚')) {
    return '嗯，我了解一些。不过我更想听你讲讲——你亲身经历的那段，对我来说是独一无二的。能详细说说吗？'
  }

  // 用户表示话题才刚开始
  if (userLower.includes('才刚刚开始') || userLower.includes('还没说完') || userLower.includes('继续')) {
    return '哦对不起，是我太着急了。我们继续聊这个话题，你刚才说的很有意思，能再多说一点吗？'
  }

  // 用户说换话题
  if (userLower.includes('下一个') || userLower.includes('换话题') || userLower.includes('好了')) {
    const nextDim = INTERVIEW_DIMENSIONS[INTERVIEW_DIMENSIONS.findIndex(d => d.id === dimensionId) + 1]
    if (nextDim) {
      return `好的，咱们换个话题。接下来聊聊"${nextDim.name}"吧。${nextDim.prompts[0]}`
    } else {
      return `太棒了！咱们把所有话题都聊完了。让我帮你整理一下这些回忆...`
    }
  }

  // 用户提到具体地点/人名/事件——追问细节
  if (userMessage.length > 15) {
    const followUps = [
      `你刚才说的"${userMessage.slice(0, 12)}..."，能再多说一点吗？我很好奇。`,
      `听起来那段经历对你很重要。那时候你是什么感觉？`,
      `嗯，我在认真听。后来呢？发生了什么？`,
      `这个细节很有意思，你还能想起更多吗？`,
    ]
    return followUps[assistantMsgCount % followUps.length]
  }

  // 默认：从维度提示词里选一个
  const dimension = INTERVIEW_DIMENSIONS.find(d => d.id === dimensionId)
  if (dimension) {
    const promptIdx = assistantMsgCount % dimension.prompts.length
    return dimension.prompts[promptIdx]
  }

  return '我在听，你继续说。'
}

// ============ 主服务接口 ============

/**
 * 发送聊天消息，获取 AI 响应
 * 优先级：GitHub Models → HuggingFace → 智能 Mock
 */
export async function chat(
  messages: ChatMessage[],
  dimensionId: string
): Promise<{ reply: string; done: boolean }> {
  const dimension = INTERVIEW_DIMENSIONS.find(d => d.id === dimensionId)
  const dimensionName = dimension?.name || '未知'
  const dimensionDesc = dimension?.description || ''

  // 尝试顺序：GitHub Models → HuggingFace → Mock
  const providers = [
    { name: 'GitHub Models', fn: callGitHubModels },
    { name: 'HuggingFace', fn: callHuggingFace },
  ]

  for (const provider of providers) {
    try {
      const reply = await provider.fn(messages, dimensionName, dimensionDesc)
      const done = reply.includes('整理一下') || reply.includes('所有话题')
      console.log(`[AI] 使用 ${provider.name} 回复成功`)
      return { reply, done }
    } catch (err: any) {
      console.warn(`[AI] ${provider.name} 失败:`, err.message)
      // 继续尝试下一个
    }
  }

  // 全部失败，使用智能 Mock
  console.log('[AI] 所有 API 失败，使用智能 Mock 模式')
  const userMessage = messages[messages.length - 1]?.content || ''
  const reply = generateSmartMockReply(userMessage, messages, dimensionId)
  const done = reply.includes('整理一下')
  return { reply, done }
}

/**
 * 根据访谈记录生成故事脉络
 */
export async function generateStory(messages: ChatMessage[]): Promise<string> {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content)
  let story = `# 我的回忆录\n\n`
  story += `## 访谈记录\n\n`
  userMessages.forEach((msg, i) => {
    story += `### 片段 ${i + 1}\n${msg}\n\n`
  })
  story += `## 故事脉络（AI 整理中...）\n\n`
  story += `正在根据您的口述内容，整理成连贯的故事...\n\n`
  return story
}
