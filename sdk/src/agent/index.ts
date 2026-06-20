/**
 * 忆往昔 SDK — Agent 工具注册表
 * 定义 Function Calling 工具接口，不含具体数据库实现
 */

import type { AgentTool, OpenAIFunction } from '../types/index.js'

/**
 * 创建 Agent 工具注册表（工厂函数，由使用方注入具体实现）
 */
export function createAgentTools(
  handlers: Record<string, (args: Record<string, unknown>, userId: string) => Promise<string>>
): AgentTool[] {
  return [
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
      handler: handlers.list_memoirs,
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
      handler: handlers.create_memoir,
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
      handler: handlers.search_memoirs,
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
      handler: handlers.list_photos,
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
      handler: handlers.search_photos,
    },

    // ============ 家族树工具 ============
    {
      name: 'list_family',
      description: '获取用户的亲友列表。用于查看/管理家族成员。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: '分类：family|class_mate|friend',
          },
        },
      },
      handler: handlers.list_family,
    },
    {
      name: 'add_family_member',
      description: '添加亲友/家族成员。用户说"把我妈加进来"时调用。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '姓名' },
          category: {
            type: 'string',
            description: '分类：family/class_mate/friend',
          },
          relationship: { type: 'string', description: '关系，如：母亲/父亲/同学' },
          generation: {
            type: 'number',
            description: '辈分：+1=父辈, 0=同辈, -1=子辈',
          },
        },
        required: ['name', 'category'],
      },
      handler: handlers.add_family_member,
    },

    // ============ 爱好工具 ============
    {
      name: 'list_hobbies',
      description: '获取用户的爱好列表。用于展示金曲/电影/比赛记录。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: '分类：music/movie/sport/custom',
          },
        },
      },
      handler: handlers.list_hobbies,
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
      handler: handlers.add_hobby,
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
      handler: handlers.list_capture_sessions,
    },

    // ============ 用户工具 ============
    {
      name: 'get_user_stats',
      description: '获取用户的数据统计。"您有X篇回忆录、Y张照片"。',
      parameters: { type: 'object', properties: {} },
      handler: handlers.get_user_stats,
    },

    // ============ 搜索工具 ============
    {
      name: 'smart_search',
      description:
        '全局智能搜索。用户说"找关于童年的"或"奶奶的照片"时调用。搜索回忆录、照片、爱好、亲友。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词或自然语言查询' },
        },
        required: ['query'],
      },
      handler: handlers.smart_search,
    },

    // ============ 活跃度工具 ============
    {
      name: 'get_recent_activity',
      description: '获取用户最近活动摘要。主动建议"您这周拍了3张照片，要写故事吗？"',
      parameters: { type: 'object', properties: {} },
      handler: handlers.get_recent_activity,
    },
  ]
}

/**
 * 将工具列表转换为 OpenAI Function Calling 格式
 */
export function toolsToOpenAIFunctions(tools: AgentTool[]): OpenAIFunction[] {
  return tools.map((t) => ({
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
export async function executeTool(
  tools: AgentTool[],
  name: string,
  args: string,
  userId: string
): Promise<string> {
  const tool = tools.find((t) => t.name === name)
  if (!tool) return `未知工具: ${name}`

  // 解析参数
  let parsedArgs: Record<string, unknown> = {}
  if (args == null || args === '') {
    parsedArgs = {}
  } else if (typeof args === 'object') {
    parsedArgs = args as Record<string, unknown>
  } else if (typeof args === 'string') {
    try {
      const v = JSON.parse(args)
      parsedArgs = typeof v === 'object' && v !== null ? v : {}
    } catch {
      return `工具 ${name} 参数解析失败：AI 返回了非 JSON 格式的参数 (${args.substring(0, 50)})`
    }
  } else {
    return `工具 ${name} 参数类型错误: ${typeof args}`
  }

  try {
    return await tool.handler(parsedArgs, userId)
  } catch (err) {
    return `工具 ${name} 执行失败: ${(err as Error).message}`
  }
}

/**
 * 默认工具名称列表
 */
export const DEFAULT_TOOL_NAMES = [
  'list_memoirs',
  'create_memoir',
  'search_memoirs',
  'list_photos',
  'search_photos',
  'list_family',
  'add_family_member',
  'list_hobbies',
  'add_hobby',
  'list_capture_sessions',
  'get_user_stats',
  'smart_search',
  'get_recent_activity',
] as const
