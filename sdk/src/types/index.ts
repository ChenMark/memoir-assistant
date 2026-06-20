/**
 * 忆往昔 SDK — 核心类型定义
 * 独立于 Prisma/Express，可用于客户端和 Node.js 环境
 */

// ==================== 用户 ====================

export interface User {
  id: string
  username: string
  email: string
  phone?: string
  phoneVerified?: boolean
  passwordHash: string
  salt: string
  createdAt: string
  updatedAt: string
  avatar?: string
  bio?: string
  wechatOpenId?: string
  wechatUnionId?: string
  wechatNickname?: string
  qqOpenId?: string
  qqNickname?: string
}

/** 脱敏后的用户（不含密码） */
export type SafeUser = Omit<User, 'passwordHash' | 'salt'>

// ==================== JWT ====================

export interface JWTPayload {
  sub: string
  username: string
  email: string
  iat: number
  exp: number
}

// ==================== AI 对话 ====================

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

// ==================== Agent 工具 ====================

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  /** 执行工具，返回结果字符串 */
  handler: (args: Record<string, unknown>, userId: string) => Promise<string>
}

/** OpenAI Function Calling 格式的工具定义 */
export interface OpenAIFunction {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

// ==================== 搜索 ====================

export type SearchResultType = 'memoir' | 'photo' | 'hobby' | 'friend' | 'capture'

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  snippet: string
  date?: string
  relevance: number
}

// ==================== 回忆录 ====================

export interface Memoir {
  id: string
  userId: string
  title: string
  content: string
  date: string
  tags: string[]
  mood?: string
  location?: string
  media: string[]
  isPublished: boolean
  isDraft: boolean
  wordCount: number
  createdAt: string
  updatedAt: string
}

export interface MemoirDraft {
  id: string
  userId: string
  title: string
  content: string
  date?: string
  tags: string[]
  mood?: string
  media: string[]
  createdAt: string
  updatedAt: string
}

// ==================== 画廊/相册 ====================

export interface GalleryItem {
  id: string
  userId: string
  ossKey: string
  caption: string
  tags: string[]
  date: string
  memoirId?: string
  downloadUrl?: string
  commentCount: number
  shareCount: number
  createdAt: string
  updatedAt: string
}

export interface PhotoComment {
  id: string
  userId: string
  username: string
  avatar?: string
  content: string
  createdAt: string
}

export interface PhotoShareToken {
  token: string
  photoId: string
  expiresAt: string
}

// ==================== 亲友/家族 ====================

export type FriendCategory = 'family' | 'class_mate' | 'friend'

export interface Friend {
  id: string
  userId: string
  name: string
  avatar?: string
  category: FriendCategory
  relationship?: string
  generation?: number
  parentId?: string
  spouseId?: string
  school?: string
  classInfo?: string
  graduationYear?: string
  metAt?: string
  metYear?: string
  tags: string[]
  addedAt: string
}

// ==================== 爱好 ====================

export type HobbyCategory = 'music' | 'movie' | 'sport' | 'custom'

export interface Hobby {
  id: string
  userId: string
  category: HobbyCategory
  title: string
  description: string
  rating?: number
  year?: string
  tags: string[]
  createdAt: string
}

// ==================== 采集会话 ====================

export interface CaptureSession {
  id: string
  userId: string
  type: 'photo' | 'video'
  date: string
  itemCount: number
  duration?: number
  transcript?: string
  createdAt: string
}

// ==================== 通知 ====================

export type NotificationType = 'comment' | 'share' | 'reminder' | 'system'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  content: string
  isRead: boolean
  relatedId?: string
  relatedType?: string
  createdAt: string
}

// ==================== 书签/收藏 ====================

export type BookmarkType = 'memoir' | 'photo' | 'hobby' | 'friend'

export interface Bookmark {
  id: string
  userId: string
  targetType: BookmarkType
  targetId: string
  createdAt: string
}

// ==================== 提醒 ====================

export type ReminderType = 'birthday' | 'anniversary' | 'custom'

export interface Reminder {
  id: string
  userId: string
  type: ReminderType
  title: string
  description?: string
  targetDate: string
  repeatYearly: boolean
  isActive: boolean
  createdAt: string
}

// ==================== 紧急联系人 ====================

export interface EmergencyContact {
  id: string
  userId: string
  name: string
  phone: string
  relationship: string
  isPrimary: boolean
  createdAt: string
}

// ==================== 隐私分组 ====================

export interface PrivacyCircle {
  id: string
  userId: string
  name: string
  memberIds: string[]
  createdAt: string
}

// ==================== API 通用响应 ====================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface PaginationParams {
  page?: number
  limit?: number
}

// ==================== OSS ====================

export interface OSSConfig {
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  region: string
}

export interface OSSSignOptions {
  key: string
  contentType?: string
  method?: 'PUT' | 'GET'
  expires?: number
}

export interface OSSClient {
  /** 生成上传签名 URL */
  generateUploadUrl: (key: string, contentType?: string) => Promise<string>
  /** 生成下载签名 URL */
  generateDownloadUrl: (key: string) => Promise<string>
  /** 删除对象 */
  deleteObject: (key: string) => Promise<void>
  /** 检查对象是否存在 */
  exists: (key: string) => Promise<boolean>
  /** 列出对象 */
  listObjects: (prefix: string) => Promise<string[]>
}

// ==================== SDK 配置 ====================

export interface SDKConfig {
  baseUrl: string
  apiPrefix?: string
  token?: string
  timeout?: number
}
