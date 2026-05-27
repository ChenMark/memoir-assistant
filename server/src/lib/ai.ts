/**
 * AI 服务库 - 回忆录引导对话
 * 支持 Mock 模式和 OpenAI API 模式
 */

// =========== 类型定义 ===========

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

// =========== 引导维度定义 ===========

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
    description: '引导用户回忆父母、配偶、子女等亲人',
    prompts: [
      '能跟我讲讲你的父母吗？他们是怎样的人？',
      '你和配偶是怎么认识的？有什么浪漫的故事吗？',
      '作为父母，你最想给孩子留下什么话？',
      '家庭中有没有什么传统或习惯，一直延续到现在？',
      '如果可以回到过去，你最想和家人一起做什么？',
    ],
  },
  {
    id: 'oldage',
    name: '人生感悟',
    description: '引导用户反思人生、分享智慧与感悟',
    prompts: [
      '回顾这一生，你最骄傲的是什么？',
      '如果可以重来，你会做哪些不同的选择？',
      '有什么人生经验，你想传给下一代？',
      '现在的生活，和你年轻时的想象一样吗？',
      '你最想被后人记住的是什么？',
    ],
  },
]

// =========== Mock AI 实现 ===========

/**
 * Mock AI 响应生成器
 * 根据用户输入和当前维度，生成引导性问题或总结
 */
function generateMockResponse(
  userMessage: string,
  dimensionId: string,
  messageCount: number
): string {
  const dimension = INTERVIEW_DIMENSIONS.find((d) => d.id === dimensionId)
  if (!dimension) {
    return '让我们继续聊聊吧。'
  }

  // 简单的响应逻辑：根据消息数量决定是提问还是总结
  if (messageCount < 3) {
    // 前3轮：提问
    const promptIndex = messageCount % dimension.prompts.length
    return dimension.prompts[promptIndex]
  } else if (messageCount < 6) {
    // 3-6轮：深入追问
    const followUps = [
      `刚才你提到的很有意思，能再详细说说吗？`,
      `我注意到你说到了"${userMessage.slice(0, 10)}..."，那时候你的感受是什么？`,
      `这个经历对你后来有什么影响吗？`,
    ]
    return followUps[messageCount % followUps.length]
  } else {
    // 6轮以上：总结并过渡到下一维度
    const nextDimension = INTERVIEW_DIMENSIONS[
      INTERVIEW_DIMENSIONS.findIndex((d) => d.id === dimensionId) + 1
    ]
    if (nextDimension) {
      return `好的，我已经记录了你关于"${dimension.name}"的回忆。接下来，让我们聊聊"${nextDimension.name}"吧。${nextDimension.prompts[0]}`
    } else {
      return `非常好！我们已经聊完了所有话题。现在让我帮你整理一下这些回忆，生成你的故事脉络...`
    }
  }
}

/**
 * Mock 故事生成器
 */
function generateMockStory(messages: ChatMessage[]): string {
  const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content)

  let story = `# 我的回忆录\n\n`

  story += `## 访谈记录\n\n`
  userMessages.forEach((msg, i) => {
    story += `### 片段 ${i + 1}\n${msg}\n\n`
  })

  story += `## 故事脉络（AI 整理中...）\n\n`
  story += `正在根据您的口述内容，整理成连贯的故事...（真实环境中，这里会调用 GPT-4 生成）\n\n`

  return story
}

// =========== 主服务接口 ===========

/**
 * 发送聊天消息，获取 AI 响应
 */
export async function chat(
  messages: ChatMessage[],
  dimensionId: string
): Promise<{ reply: string; done: boolean }> {
  // TODO: 真实环境中，这里应该调用 OpenAI API
  // const response = await fetch('https://api.openai.com/v1/chat/completions', ...)
  
  // Mock 模式：模拟延迟，生成响应
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

  const userMessage = messages[messages.length - 1]?.content || ''
  const assistantMessageCount = messages.filter((m) => m.role === 'assistant').length

  const reply = generateMockResponse(userMessage, dimensionId, assistantMessageCount)
  const done = reply.includes('生成你的故事脉络')

  return { reply, done }
}

/**
 * 根据访谈记录生成故事脉络
 */
export async function generateStory(messages: ChatMessage[]): Promise<string> {
  // TODO: 真实环境中，这里调用 OpenAI API 生成故事
  // const prompt = buildStoryPrompt(messages)
  // const response = await openai.chat.completions.create({...})

  // Mock 模式
  await new Promise((resolve) => setTimeout(resolve, 2000))
  return generateMockStory(messages)
}

/**
 * 获取引导维度列表
 */
export function getDimensions(): InterviewDimension[] {
  return INTERVIEW_DIMENSIONS
}
