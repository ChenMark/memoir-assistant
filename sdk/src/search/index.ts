/**
 * 忆往昔 SDK — 语义搜索
 * 标签感知 + 中文分词模糊搜索
 */

import type { SearchResult, SearchResultType } from '../types/index.js'

/**
 * 中文/英文混合分词
 * 中文按2字/单字滑窗切分，英文按单词切分
 */
export function tokenize(query: string): string[] {
  const tokens: string[] = []
  // 1) 英文/数字单词
  const enMatches = query.toLowerCase().match(/[a-z0-9]+/g) || []
  tokens.push(...enMatches)
  // 2) 中文词组切分
  const cnMatches = query.match(/[\u4e00-\u9fa5]+/g) || []
  for (const cn of cnMatches) {
    if (cn.length <= 2) {
      tokens.push(cn)
    } else {
      for (let i = 0; i < cn.length - 1; i++) tokens.push(cn.substring(i, i + 2))
      for (let i = 0; i < cn.length; i++) tokens.push(cn[i])
    }
  }
  // 3) 去重
  return Array.from(new Set(tokens.filter((t) => t.length > 0)))
}

/**
 * 关键词匹配得分 — 精确匹配 > 前缀匹配 > 包含匹配
 */
export function matchScore(keywords: string[], text: string): number {
  const lower = text.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (lower === kw) {
      score += 10
      continue
    }
    if (lower.startsWith(kw)) {
      score += 5
      continue
    }
    if (lower.includes(kw)) {
      score += 2
      continue
    }
  }
  return score
}

/**
 * 搜索结果排序（按相关性降序，取前 N 条）
 */
export function rankAndSlice(results: SearchResult[], topN = 10): SearchResult[] {
  return results.sort((a, b) => b.relevance - a.relevance).slice(0, topN)
}

/**
 * 在给定文档集合中执行搜索
 */
export function searchInDocuments<T extends { id: string; searchText: string }>(
  query: string,
  documents: T[],
  type: SearchResultType,
  getter: (doc: T) => { title: string; snippet: string; date?: string }
): SearchResult[] {
  const keywords = tokenize(query)
  if (keywords.length === 0) return []

  const results: SearchResult[] = []
  for (const doc of documents) {
    const score = matchScore(keywords, doc.searchText)
    if (score > 0) {
      const { title, snippet, date } = getter(doc)
      results.push({ type, id: doc.id, title, snippet, date, relevance: score })
    }
  }
  return results
}

/**
 * 多文档集合联合搜索
 */
export async function semanticSearch(
  query: string,
  collections: Record<
    SearchResultType,
    Array<{ id: string; searchText: string; title: string; snippet: string; date?: string }>
  >
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = []

  for (const [type, docs] of Object.entries(collections)) {
    const keywords = tokenize(query)
    if (keywords.length === 0) continue

    for (const doc of docs) {
      const score = matchScore(keywords, doc.searchText)
      if (score > 0) {
        allResults.push({
          type: type as SearchResultType,
          id: doc.id,
          title: doc.title,
          snippet: doc.snippet,
          date: doc.date,
          relevance: score,
        })
      }
    }
  }

  return rankAndSlice(allResults, 10)
}
