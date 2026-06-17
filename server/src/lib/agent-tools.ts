/**
 * Agent 工具注册表 — 将现有 REST API 映射为 Function Calling 工具
 * 每个工具包含: name, description, parameters (JSON Schema), handler
 */
import { prisma } from './prisma.js'
import { generateDownloadUrl } from './oss.js'
import { semanticSearch } from './semantic-search.js'

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  /** 执行工具，返回结果字符串 */
  handler: (args: Record<string, unknown>, userId: string) => Promise<string>
}

export const agentTools: AgentTool[] = [
  // ============ 回忆录工具 ============
  {
    name: 'list_memoirs',
    description: '获取用户的回忆录列表。用于浏览已有的回忆录条目。',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回条数，默认20' },
      },
    },
    async handler(args, userId) {
      const memoirs = await prisma.memoir.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(50, (args.limit as number) || 20),
        select: { id: true, title: true, date: true, tags: true, createdAt: true },
      })
      if (memoirs.length === 0) return '暂无回忆录记录'
      return memoirs.map((m: any) =>
        `- [${m.date}] ${m.title} （标签: ${JSON.parse(m.tags || '[]').join('、') || '无'}）`
      ).join('\n')
    },
  },
  {
    name: 'create_memoir',
    description: '创建新的回忆录。当用户口述了一段回忆后，用此工具保存。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '回忆录标题' },
        content: { type: 'string', description: '回忆录正文内容' },
        date: { type: 'string', description: '回忆日期 YYYY-MM-DD' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        mood: { type: 'string', description: '心情：开心/感动/怀念/平静/感慨' },
      },
      required: ['title', 'content', 'date'],
    },
    async handler(args, userId) {
      const memoir = await prisma.memoir.create({
        data: {
          userId,
          title: args.title as string,
          content: args.content as string,
          date: args.date as string,
          tags: JSON.stringify(args.tags || []),
          mood: (args.mood as string) || null,
          media: '[]',
        },
      })
      return `回忆录「${memoir.title}」已保存（ID: ${memoir.id}）`
    },
  },
  {
    name: 'search_memoirs',
    description: '按关键词搜索回忆录。用户问"有没有关于童年的"时调用。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词' },
      },
      required: ['keyword'],
    },
    async handler(args, userId) {
      const memoirs = await prisma.memoir.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: args.keyword as string } },
            { content: { contains: args.keyword as string } },
            { tags: { contains: args.keyword as string } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, date: true, content: true },
      })
      if (memoirs.length === 0) return `未找到包含「${args.keyword}」的回忆录`
      return memoirs.map((m: any) =>
        `- [${m.date}] ${m.title}\n  ${m.content.substring(0, 80)}...`
      ).join('\n\n')
    },
  },

  // ============ 相册工具 ============
  {
    name: 'list_photos',
    description: '获取用户的相册照片列表。用于查看已录入的照片。',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回条数，默认20' },
      },
    },
    async handler(args, userId) {
      const photos = await prisma.gallery.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(50, (args.limit as number) || 20),
        select: { id: true, caption: true, date: true, tags: true, createdAt: true },
      })
      if (photos.length === 0) return '相册中暂无照片'
      return photos.map((p: any) =>
        `- [${p.date}] ${p.caption || '未命名'} （标签: ${JSON.parse(p.tags || '[]').join('、') || '无'}）`
      ).join('\n')
    },
  },
  {
    name: 'search_photos',
    description: '搜索相册中的照片。用户问"找那张日落的"时调用。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键词' },
      },
      required: ['keyword'],
    },
    async handler(args, userId) {
      const photos = await prisma.gallery.findMany({
        where: {
          userId,
          OR: [
            { caption: { contains: args.keyword as string } },
            { tags: { contains: args.keyword as string } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, caption: true, date: true, ossKey: true },
      })
      if (photos.length === 0) return `相册中未找到包含「${args.keyword}」的照片`
      return photos.map((p: any) =>
        `- [${p.date}] ${p.caption || '未命名'}`
      ).join('\n')
    },
  },

  // ============ 家族树工具 ============
  {
    name: 'list_family',
    description: '获取用户的亲友列表。用于查看/管理家族成员。',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: '分类：family|class_mate|friend' },
      },
    },
    async handler(args, userId) {
      const where: any = { userId }
      if (args.category) where.category = args.category
      const friends = await prisma.friend.findMany({
        where,
        orderBy: { addedAt: 'desc' },
        take: 30,
      })
      if (friends.length === 0) return '暂无亲友记录'
      return friends.map((f: any) => {
        const gen = f.generation != null ? ` [辈分: ${f.generation}]` : ''
        return `- ${f.name}（${f.category}）${gen}${f.relationship ? ` 关系: ${f.relationship}` : ''}`
      }).join('\n')
    },
  },
  {
    name: 'add_family_member',
    description: '添加亲友/家族成员。用户说"把我妈加进来"时调用。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '姓名' },
        category: { type: 'string', description: '分类：family/class_mate/friend' },
        relationship: { type: 'string', description: '关系，如：母亲/父亲/同学' },
        generation: { type: 'number', description: '辈分：+1=父辈, 0=同辈, -1=子辈' },
      },
      required: ['name', 'category'],
    },
    async handler(args, userId) {
      const friend = await prisma.friend.create({
        data: {
          userId,
          name: args.name as string,
          category: args.category as string,
          relationship: (args.relationship as string) || null,
          generation: args.generation != null ? (args.generation as number) : null,
          tags: '[]',
        },
      })
      return `已将「${friend.name}」添加到${args.category === 'family' ? '家族' : '亲友'}列表`
    },
  },

  // ============ 爱好工具 ============
  {
    name: 'list_hobbies',
    description: '获取用户的爱好列表。用于展示金曲/电影/比赛记录。',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: '分类：music/movie/sport/custom' },
      },
    },
    async handler(args, userId) {
      const where: any = { userId }
      if (args.category) where.category = args.category
      const hobbies = await prisma.hobby.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      if (hobbies.length === 0) return '暂无爱好记录'
      return hobbies.map((h: any) =>
        `- [${h.category}] ${h.title} ${h.rating ? '⭐'.repeat(h.rating) : ''}${h.year ? ` (${h.year})` : ''}`
      ).join('\n')
    },
  },
  {
    name: 'add_hobby',
    description: '添加爱好记录。用户说"把《Yesterday》记到我的金曲里"时调用。',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'music/movie/sport/custom' },
        title: { type: 'string', description: '名称' },
        description: { type: 'string', description: '描述/感想' },
        rating: { type: 'number', description: '评分 1-5' },
        year: { type: 'string', description: '年份' },
      },
      required: ['category', 'title'],
    },
    async handler(args, userId) {
      const hobby = await prisma.hobby.create({
        data: {
          userId,
          category: args.category as string,
          title: args.title as string,
          description: (args.description as string) || '',
          rating: args.rating ? Math.max(1, Math.min(5, Number(args.rating))) : null,
          tags: '[]',
          year: (args.year as string) || null,
        },
      })
      const catMap: Record<string, string> = { music: '金曲', movie: '电影', sport: '比赛', custom: '自定义' }
      return `已将「${hobby.title}」添加到${catMap[hobby.category] || hobby.category}`
    },
  },

  // ============ 采集工具 ============
  {
    name: 'list_capture_sessions',
    description: '获取摄像头采集记录。查看历史拍照/录像会话。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'photo/video' },
      },
    },
    async handler(args, userId) {
      const where: any = { userId }
      if (args.type) where.type = args.type
      const sessions = await prisma.captureSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
      if (sessions.length === 0) return '暂无采集记录'
      return sessions.map((s: any) => {
        const icon = s.type === 'photo' ? '📷' : '🎥'
        const extra = s.type === 'video' && s.duration ? ` 时长${s.duration}秒` : ` ${s.itemCount}张`
        return `${icon} [${s.date}]${extra}${s.transcript ? `\n  旁白: ${s.transcript.substring(0, 60)}` : ''}`
      }).join('\n\n')
    },
  },

  // ============ 用户工具 ============
  {
    name: 'get_user_stats',
    description: '获取用户的数据统计。用于展示"您有X篇回忆录、Y张照片"。',
    parameters: { type: 'object', properties: {} },
    async handler(_args, userId) {
      const [memoirCount, photoCount, friendCount, hobbyCount] = await Promise.all([
        prisma.memoir.count({ where: { userId } }),
        prisma.gallery.count({ where: { userId } }),
        prisma.friend.count({ where: { userId } }),
        prisma.hobby.count({ where: { userId } }),
      ])
      return [
        `📝 回忆录: ${memoirCount} 篇`,
        `🖼️ 照片: ${photoCount} 张`,
        `👥 亲友: ${friendCount} 人`,
        `❤️ 爱好: ${hobbyCount} 条`,
      ].join('\n')
    },
  },

  // ============ 搜索工具 ============
  {
    name: 'smart_search',
    description: '全局智能搜索。用户说"找关于童年的"或"奶奶的照片"时调用。搜索回忆录、照片、爱好、亲友。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词或自然语言查询' },
      },
      required: ['query'],
    },
    async handler(args, userId) {
      const results = await semanticSearch(userId, args.query as string)
      if (results.length === 0) return `未找到与「${args.query}」相关的内容`
      return results.map((r, i) => {
        const icon = { memoir: '📝', photo: '🖼️', hobby: '❤️', friend: '👤' }[r.type]
        return `${i + 1}. ${icon} [${r.type}] ${r.title}\n   ${r.snippet}`
      }).join('\n\n')
    },
  },

  // ============ 活跃度工具 ============
  {
    name: 'get_recent_activity',
    description: '获取用户最近活动摘要。用于主动建议"您这周拍了3张照片，要写故事吗？"',
    parameters: { type: 'object', properties: {} },
    async handler(_args, userId) {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const [recentMemoirs, recentPhotos, recentSessions] = await Promise.all([
        prisma.memoir.count({ where: { userId, createdAt: { gte: weekAgo } } }),
        prisma.gallery.count({ where: { userId, createdAt: { gte: weekAgo } } }),
        prisma.captureSession.count({ where: { userId, createdAt: { gte: weekAgo } } }),
      ])
      return [
        `📅 过去7天活动：`,
        `  回忆录: ${recentMemoirs} 篇`,
        `  照片: ${recentPhotos} 张`,
        `  采集会话: ${recentSessions} 次`,
      ].join('\n')
    },
  },
]

/**
 * 将工具列表转换为 OpenAI Function Calling 格式
 */
export function toolsToOpenAIFunctions() {
  return agentTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

/**
 * 根据名称查找并执行工具
 */
export async function executeTool(name: string, args: string, userId: string): Promise<string> {
  const tool = agentTools.find((t) => t.name === name)
  if (!tool) return `未知工具: ${name}`
  try {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
    return await tool.handler(parsedArgs, userId)
  } catch (err) {
    return `工具执行失败: ${(err as Error).message}`
  }
}
