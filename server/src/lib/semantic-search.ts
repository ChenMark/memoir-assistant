/**
 * 语义搜索服务 — 标签感知模糊搜索
 * 不依赖外部嵌入 API，使用本地标签+关键词匹配
 */
import { prisma } from './prisma.js'

export interface SearchResult {
  type: 'memoir' | 'photo' | 'hobby' | 'friend'
  id: string
  title: string
  snippet: string
  date?: string
  relevance: number
}

/**
 * 全局语义搜索 — 同时搜索回忆录、照片、爱好、亲友
 */
export async function semanticSearch(userId: string, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 0)

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
