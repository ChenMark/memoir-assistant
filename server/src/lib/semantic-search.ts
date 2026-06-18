/**
 * 语义搜索服务 — 标签感知模糊搜索
 * 不依赖外部嵌入 API，使用本地标签+关键词匹配
 */
import { prisma } from './prisma.js'

export interface SearchResult {
  // ✅ S6 修复：补充 'capture' 类型（与 search.ts 实际使用一致）
  type: 'memoir' | 'photo' | 'hobby' | 'friend' | 'capture'
  id: string
  title: string
  snippet: string
  date?: string
  relevance: number
}

/**
 * 关键词提取 — 支持中文/英文混合查询
 * 中文按字符切分（无空格），英文按空格切分
 */
function tokenize(query: string): string[] {
  const tokens: string[] = []
  // 1) 提取英文/数字单词
  const enMatches = query.toLowerCase().match(/[a-z0-9]+/g) || []
  tokens.push(...enMatches)
  // 2) 提取连续中文字符（按2字/3字/单字切分）
  const cnMatches = query.match(/[\u4e00-\u9fa5]+/g) || []
  for (const cn of cnMatches) {
    if (cn.length <= 2) {
      tokens.push(cn)
    } else {
      // 滑窗切分：2字+单字
      for (let i = 0; i < cn.length - 1; i++) tokens.push(cn.substring(i, i + 2))
      for (let i = 0; i < cn.length; i++) tokens.push(cn[i])
    }
  }
  // 3) 去重
  return Array.from(new Set(tokens.filter((t) => t.length > 0)))
}

/**
 * 全局语义搜索 — 同时搜索回忆录、照片、爱好、亲友
 * MEDIUM-12: 使用中文分词替代 split(/\s+/)
 */
export async function semanticSearch(userId: string, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const keywords = tokenize(query)

  if (keywords.length === 0) return []

  // 搜索回忆录
  const memoirs = await prisma.memoir.findMany({
    where: { userId },
    select: { id: true, title: true, content: true, tags: true, date: true, mood: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  for (const m of memoirs) {
    const score = matchScore(keywords, [m.title, m.content, m.tags, m.mood].filter(Boolean).join(' '))
    if (score > 0) {
      results.push({
        type: 'memoir', id: m.id, title: m.title,
        snippet: m.content.substring(0, 100) + '...', date: m.date, relevance: score,
      })
    }
  }

  // 搜索照片
  const photos = await prisma.gallery.findMany({
    where: { userId },
    select: { id: true, caption: true, tags: true, date: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  for (const p of photos) {
    const score = matchScore(keywords, [p.caption, p.tags].join(' '))
    if (score > 0) {
      results.push({
        type: 'photo', id: p.id, title: p.caption || '未命名照片',
        snippet: `日期: ${p.date}`, date: p.date, relevance: score,
      })
    }
  }

  // 搜索爱好
  const hobbies = await prisma.hobby.findMany({
    where: { userId },
    select: { id: true, title: true, description: true, tags: true, category: true, year: true },
    take: 20,
  })
  for (const h of hobbies) {
    const score = matchScore(keywords, [h.title, h.description, h.tags, h.category].join(' '))
    if (score > 0) {
      results.push({
        type: 'hobby', id: h.id, title: h.title,
        snippet: `${h.category}${h.year ? ` (${h.year})` : ''}`, relevance: score,
      })
    }
  }

  // 搜索亲友
  const friends = await prisma.friend.findMany({
    where: { userId },
    select: { id: true, name: true, relationship: true, tags: true, category: true },
    take: 20,
  })
  for (const f of friends) {
    const score = matchScore(keywords, [f.name, f.relationship || '', f.tags, f.category].join(' '))
    if (score > 0) {
      results.push({
        type: 'friend', id: f.id, title: f.name,
        snippet: f.relationship || f.category, relevance: score,
      })
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance).slice(0, 10)
}

/**
 * 关键词匹配得分 — 精确匹配 > 前缀匹配 > 包含匹配
 */
function matchScore(keywords: string[], text: string): number {
  const lower = text.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (lower === kw) { score += 10; continue }
    if (lower.startsWith(kw)) { score += 5; continue }
    if (lower.includes(kw)) { score += 2; continue }
  }
  return score
}
