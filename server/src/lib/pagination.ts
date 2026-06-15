/**
 * 分页工具 — 统一分页参数解析与响应封装
 */

export interface PaginationQuery {
  page: number
  limit: number
  skip: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

/**
 * 从请求查询参数解析分页参数
 * @param rawPage 原始页码（1-based）
 * @param rawLimit 原始每页数量
 * @returns 标准化的分页参数（skip 用于 Prisma）
 */
export function parsePagination(rawPage?: any, rawLimit?: any): PaginationQuery {
  const page = Math.max(1, parseInt(rawPage as string, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(rawLimit as string, 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

/**
 * 构建分页响应
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
}
