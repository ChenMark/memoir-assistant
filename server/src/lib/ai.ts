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

// ============ 引导维度定义 — 10阶段 × 10核心提示词 ============
// 每阶段覆盖典型共性体验，降低沟通复杂度，提升采访效率

export const INTERVIEW_DIMENSIONS: InterviewDimension[] = [
  {
    id: 'childhood',
    name: '童年记忆',
    description: '0-12岁的成长环境、家庭生活、童趣经历',
    prompts: [
      '你出生在哪里？能描述一下你最早的家是什么样子吗？',
      '小时候家里有几口人？每个人在你记忆里是什么形象？',
      '你最早的记忆是什么？那时你多大？发生了什么？',
      '童年时你最喜欢的玩具或游戏是什么？跟谁一起玩？',
      '你小时候最害怕什么？有没有印象深刻的一次哭鼻子？',
      '父母在你小时候是怎么管教你和你兄弟姐妹的？',
      '你住的地方附近有什么好玩的地方吗？小河边、山坡、田野？',
      '小时候过年过节是什么样的氛围？有哪些特别的习俗？',
      '你有没有特别珍视的一样童年物件？它还在吗？',
      '如果用一个词形容你的童年，你会选什么？为什么？',
    ],
  },
  {
    id: 'school',
    name: '校园时光',
    description: '小学到高中的学习生活、老师同学、课外活动',
    prompts: [
      '你还记得第一天上学的情景吗？当时是什么心情？',
      '小学时你最喜欢哪门课？最不喜欢哪门课？',
      '有没有一位老师让你印象特别深刻？TA 改变了你什么？',
      '你在班里跟谁关系最好？你们是怎么成为朋友的？',
      '上学时有没有被欺负或被排挤的经历？怎么度过的？',
      '你参加过什么课外活动吗？运动会、文艺表演、社团？',
      '中学时你有没有暗恋过谁？或者收到过情书？',
      '那时候你的零花钱是多少？怎么花的？',
      '高考/中考那段日子你还记得吗？你付出了什么样的努力？',
      '如果有机会对那个年代的自己说一句话，你会说什么？',
    ],
  },
  {
    id: 'youth',
    name: '青春年华',
    description: '大学时代、青春迷茫、理想追求、友谊与爱情',
    prompts: [
      '你是哪所大学毕业的？当时为什么会选择这所学校？',
      '大学期间你最难忘的一件事是什么？',
      '你的室友是什么样的人？你们之间有什么有趣的故事？',
      '那时候你一个月生活费多少？怎么安排花销的？',
      '大学时有没有做过兼职或打工？学到了什么？',
      '你年轻时有什么疯狂的梦想？有没有为之努力过？',
      '青春时代你有没有追过星？喜欢哪个歌手或演员？',
      '你和你最好的朋友是怎么认识的？维持了多少年？',
      '大学时你谈过恋爱吗？那段感情教会了你什么？',
      '毕业后你和大学同学还有联系吗？常聚吗？',
    ],
  },
  {
    id: 'career-start',
    name: '初入社会',
    description: '第一份工作、职场新人的成长与挑战',
    prompts: [
      '你还记得面试第一份工作的情景吗？紧张吗？',
      '你的第一份工资是多少？当时怎么花的这笔钱？',
      '第一天上班你做了什么？有没有出糗的事？',
      '初入职场时，你觉得最大的落差是什么？',
      '你的第一位上司是什么样的人？从TA身上学到了什么？',
      '你刚工作时遇到过什么困难？是怎么熬过来的？',
      '工作后你拿到第一笔"大钱"是什么时候？做了什么？',
      '你有没有被人帮助过，让你至今感激的人？',
      '刚工作那几年，你怎么平衡工作和生活？',
      '如果有刚毕业的年轻人问你建议，你会怎么说？',
    ],
  },
  {
    id: 'career-peak',
    name: '职场奋斗',
    description: '职业发展的高光时刻、重要项目、行业变迁',
    prompts: [
      '你职业生涯中最有成就感的时刻是什么？',
      '你有没有主导过一个重要的项目？结果怎么样？',
      '你换过几次工作？每次换工作的原因是什么？',
      '你的行业这些年发生了哪些大的变化？',
      '你有没有遇到过特别难缠的客户或合作伙伴？怎么应对的？',
      '工作中你做过最冒险的决定是什么？值得吗？',
      '你有没有被提拔或重用的经历？当时什么感受？',
      '职场上有没有不公平的事情发生在你身上？',
      '你觉得自己在职场中最大的优势是什么？',
      '如果重新选择职业，你会走哪条路？',
    ],
  },
  {
    id: 'love',
    name: '爱情婚姻',
    description: '恋爱经历、伴侣相遇、婚姻经营',
    prompts: [
      '你和爱人是怎么认识的？第一次见面是什么情景？',
      '你们在一起后，印象最深的约会是怎样的？',
      '求婚或答应求婚的那一刻，还记得吗？',
      '结婚那天是什么样子？有没有特别难忘的细节？',
      '婚后你们经历过最大的磨合是什么？',
      '你们之间有过争吵吗？通常怎么和好的？',
      '另一半做过最让你感动的事是什么？',
      '你觉得维持一段长久关系最重要的是什么？',
      '教育孩子的问题上，你和伴侣有过分歧吗？怎么解决的？',
      '如果对另一半说一句话，你现在最想说什么？',
    ],
  },
  {
    id: 'parenthood',
    name: '为人父母',
    description: '养育孩子、家庭责任、代际传承',
    prompts: [
      '得知要当爸爸/妈妈的那一刻，你是什么心情？',
      '你的第一个孩子出生时是什么情景？你在现场吗？',
      '孩子小时候最让你头疼的事是什么？',
      '你最骄傲的孩子做到了什么？怎么培养出来的？',
      '你觉得自己在当父母这件事上学到了什么？',
      '你和孩子之间的关系怎么样？有什么特别的交流方式？',
      '你的教育理念是什么？是严格还是宽容？受谁影响？',
      '孩子长大的过程中，哪个时刻让你觉得"孩子真的长大了"？',
      '你觉得当了父母之后，自己有什么变化？',
      '你希望传递给孩子最重要的东西是什么？',
    ],
  },
  {
    id: 'turning-points',
    name: '人生转折',
    description: '关键抉择、重大变化、逆境的突破',
    prompts: [
      '你人生中有没有那种"一念之间改变一切"的时刻？',
      '你经历过最艰难的一段时光是什么？怎么走出来的？',
      '你有没有搬过家、换过城市？那次改变带来了什么？',
      '你做过的最重要的决定是什么？为什么这么选？',
      '有没有一个人，在某个关键时刻给了你巨大的帮助？',
      '你经历过怎样的健康危机或意外？那段经历教会了你什么？',
      '你有没有跟谁大吵一架之后彻底改变了关系？',
      '你创业或尝试过自己的事业吗？结果如何？',
      '你对金钱的态度是什么时候开始改变的？',
      '如果有一道生命的关键分岔口，你最感激自己做了什么选择？',
    ],
  },
  {
    id: 'family-heritage',
    name: '家庭传承',
    description: '祖辈故事、家族记忆、家风价值观',
    prompts: [
      '你的爷爷奶奶、外公外婆的故事你了解多少？能讲几个吗？',
      '你的父母是怎么认识的？他们的恋爱故事是什么？',
      '你的家庭有什么特别的传统或习惯？谁传下来的？',
      '你小时候父母给你讲过什么道理，你一直记到今天？',
      '你家有没有家谱或家族里的"名人"？讲讲他们的故事？',
      '你觉得你的性格像父母中的谁？哪些地方像？',
      '你们家有没有什么"传家宝"？不一定是值钱的东西。',
      '你的父母经历过怎样的年代？那些历史对家庭有什么影响？',
      '你觉得自己传承了家族中的什么品格？',
      '你希望后辈记住你们家族中的什么故事？',
    ],
  },
  {
    id: 'reflections',
    name: '人生感悟',
    description: '对生命的理解、智慧积淀、对未来的期许',
    prompts: [
      '回首这一生，最让你觉得骄傲的是什么？',
      '你有没有什么至今放不下的遗憾？',
      '你觉得人这一生最重要的是追求什么？',
      '有什么道理你是年纪大了之后才真正理解的？',
      '你有没有什么特别的"人生哲学"或座右铭？',
      '你觉得自己这一生中最大的幸运是什么？',
      '你害怕过死亡吗？现在怎么看待这个问题？',
      '如果能给年轻时的自己写一封信，你会说什么？',
      '你对下一代、下下一代有什么期望或寄语？',
      '你希望别人怎么记住你？你希望留下什么？',
    ],
  },
]

// ============ 系统提示词（核心）================

const SYSTEM_PROMPT = `你是一位温柔、耐心、善于倾听的回忆录引导师。你的任务是通过对话引导用户讲述他们的人生故事。

## 你的风格
- 语气温暖、自然，像一位老朋友在促膝长谈
- 每次只聚焦一个问题，不要一次性抛出多个问题
- 根据用户的回答深入追问细节，而非机械地切换话题
- 当用户提到有趣的细节时，用以下方式自然追问：
  "能和我多说说那时候的感受吗？"
  "当时周围人是什么样的反应？"
  "后来这件事对你有什么影响？"
- 如果用户不太想聊某个话题，尊重并自然过渡："没事，那咱们换个话题聊。"

## 回应的节奏
- 对简短回答(1-2句)：追问一个具体的细节
- 对详细回答(3句以上)：先表达共情理解，再自然引出下一个相关点
- 对情绪化的分享：先共情("谢谢你愿意分享这些……")，再轻柔引导

## 当前话题
我们正在聊的话题是：{dimensionName}
这个话题的方向是：{dimensionDesc}

## 重要规则
- 不要在用户刚刚开始讲述时就急于切换话题
- 只有当用户明确说"好了"、"下一个"、"换个话题"或表达强烈抗拒时，才结束当前话题
- 用"我"来称呼自己，用"你"称呼用户
- 回复控制在2-3句话以内，让用户多说
- 绝不评价用户的选择，始终保持中立和支持的态度

现在，请根据对话历史，给出你的下一句回复。`

// ============ 故事生成系统提示词 ============

const STORY_SYSTEM_PROMPT = `你是一位专业的回忆录作家。你的任务是根据用户提供的访谈记录，整理并撰写一篇连贯、感人、结构清晰的回忆录。

## 你的写作风格
- 用第一人称叙述（"我"），因为这是对用户人生的回忆
- 语言温暖、真诚、有画面感，避免空洞的形容词
- 按照时间顺序或主题逻辑组织内容
- 保留用户原话中的细节和情感，不要过度润色
- 适当补充过渡句，让故事流畅自然
- 使用markdown格式，包含标题、段落、重点标注

## 输出格式
输出一篇完整的markdown格式的回忆录，包含：
1. 标题（# 我的回忆录）
2. 引言（简短开场）
3. 正文（按主题或时间分章节）
4. 结语（如有必要）

现在，请根据用户提供的访谈记录，撰写这篇回忆录。`

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

  const data: any = await response.json()
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

  const data: any = await response.json()
  const reply = Array.isArray(data) ? data[0]?.generated_text : data.generated_text
  return reply || '嗯，我在听。'
}

// ============ 故事生成 API 调用 ============

/**
 * 调用 GitHub Models 生成故事
 */
async function generateStoryGitHubModels(messages: ChatMessage[]): Promise<string> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN not set')

  const userContent = messages
    .filter(m => m.role === 'user')
    .map((m, i) => `## 访谈片段 ${i + 1}\n${m.content}`)
    .join('\n\n')

  const response = await fetch('https://models.inference.ai.azure.com/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-ms-model': 'gpt-4o-mini',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: STORY_SYSTEM_PROMPT },
        { role: 'user', content: `以下是用户的访谈记录，请根据这些内容撰写回忆录：\n\n${userContent}` }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`GitHub Models: ${response.status} ${err}`)
  }

  const data: any = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * 调用 HuggingFace 生成故事
 */
async function generateStoryHuggingFace(messages: ChatMessage[]): Promise<string> {
  const userContent = messages
    .filter(m => m.role === 'user')
    .map((m, i) => `访谈片段 ${i + 1}: ${m.content}`)
    .join('\n\n')

  const response = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: `[INST] ${STORY_SYSTEM_PROMPT}\n\n用户访谈记录：\n${userContent}\n\n请撰写回忆录。 [/INST]`,
      parameters: { max_new_tokens: 1500, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(40000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace: ${response.status} ${err}`)
  }

  const data: any = await response.json()
  const reply = Array.isArray(data) ? data[0]?.generated_text : data.generated_text
  return reply || ''
}

/**
 * Mock故事生成（降级方案）
 */
function generateMockStory(messages: ChatMessage[]): string {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content)
  let story = `# 我的回忆录\n\n`
  story += `> 这是根据您的访谈记录自动整理的回忆录草稿，AI正在学习中...\n\n`
  
  // 按维度分组
  let currentDimension = ''
  messages.forEach((msg, i) => {
    if (msg.role === 'user') {
      story += `## ${currentDimension || '访谈记录'}\n\n`
      story += `${msg.content}\n\n`
    } else if (msg.role === 'assistant') {
      // 尝试从assistant消息中提取维度信息
      if (msg.content.includes('童年')) currentDimension = '童年时光'
      else if (msg.content.includes('青春')) currentDimension = '青春岁月'
      else if (msg.content.includes('职场')) currentDimension = '职场经历'
      else if (msg.content.includes('朋友')) currentDimension = '重要朋友'
      else if (msg.content.includes('亲人') || msg.content.includes('父母')) currentDimension = '亲人故事'
      else if (msg.content.includes('人生') || msg.content.includes('感慨')) currentDimension = '人生感悟'
    }
  })
  
  story += `\n---\n\n*注：此为自动生成的草稿，建议人工润色后使用。*\n`
  return story
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
 * 优先级：GitHub Models → HuggingFace → Mock
 */
export async function generateStory(messages: ChatMessage[]): Promise<string> {
  // 尝试顺序：GitHub Models → HuggingFace → Mock
  const providers = [
    { name: 'GitHub Models', fn: generateStoryGitHubModels },
    { name: 'HuggingFace', fn: generateStoryHuggingFace },
  ]

  for (const provider of providers) {
    try {
      const story = await provider.fn(messages)
      if (story) {
        console.log(`[AI] 使用 ${provider.name} 生成故事成功`)
        return story
      }
    } catch (err: any) {
      console.warn(`[AI] ${provider.name} 故事生成失败:`, err.message)
      // 继续尝试下一个
    }
  }

  // 全部失败，使用 Mock
  console.log('[AI] 所有 API 失败，使用 Mock 模式生成故事')
  return generateMockStory(messages)
}

/**
 * 获取引导维度列表
 */
export function getDimensions(): InterviewDimension[] {
  return INTERVIEW_DIMENSIONS
}

/**
 * 简单文本生成（不依赖 Agent 流式）
 * 用于批量任务（生成大纲、润色等）
 */
export async function generateText(prompt: string, model?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // 降级：返回原始 prompt
    return prompt
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`AI API error ${r.status}: ${t}`)
  }
  const data: any = await r.json()
  return data.choices?.[0]?.message?.content || ''
}
