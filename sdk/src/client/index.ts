/**
 * 忆往昔 SDK — Typed API Client
 * 基于 fetch 的类型安全 HTTP 客户端
 */

import type {
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  SDKConfig,
  User,
  SafeUser,
  Memoir,
  MemoirDraft,
  GalleryItem,
  PhotoComment,
  PhotoShareToken,
  Friend,
  Hobby,
  CaptureSession,
  Notification,
  Bookmark,
  Reminder,
  EmergencyContact,
  PrivacyCircle,
  SearchResult,
  ChatMessage,
  InterviewDimension,
} from '../types/index.js'
import type {
  RegisterInput,
  LoginInput,
  SendSMSInput,
  PhoneLoginInput,
  UpdateUserInput,
  CreateMemoirInput,
  UpdateMemoirInput,
  SaveDraftInput,
  CreateGalleryInput,
  ChatInput,
  CreateFriendInput,
  UpdateFriendInput,
  CreateHobbyInput,
  PaginationInput,
} from '../validators/index.js'

// ==================== HTTP Client Core ====================

export class MemoirClient {
  private baseUrl: string
  private apiPrefix: string
  private token: string | null
  private timeout: number

  constructor(config: SDKConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiPrefix = config.apiPrefix || '/api/v1'
    this.token = config.token || null
    this.timeout = config.timeout || 30000
  }

  /** 设置认证 Token */
  setToken(token: string | null): void {
    this.token = token
  }

  /** 获取当前 Token */
  getToken(): string | null {
    return this.token
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    requiresAuth = true
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (requiresAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const res = await fetch(`${this.baseUrl}${this.apiPrefix}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      })

      const data: any = await res.json()
      if (!res.ok) {
        throw new ApiError(data?.error || `${res.status} ${res.statusText}`, res.status, data)
      }
      return data as T
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ==================== Auth APIs ====================

  /** 用户注册 */
  async register(input: RegisterInput): Promise<ApiResponse<{ user: SafeUser; token: string }>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }, false)
  }

  /** 邮箱登录 */
  async login(input: LoginInput): Promise<ApiResponse<{ user: SafeUser; token: string }>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }, false)
  }

  /** 手机号登录/注册 */
  async phoneLogin(input: PhoneLoginInput): Promise<ApiResponse<{ user: SafeUser; token: string }>> {
    return this.request('/auth/phone-login', {
      method: 'POST',
      body: JSON.stringify(input),
    }, false)
  }

  /** 发送短信验证码 */
  async sendSMS(input: SendSMSInput): Promise<ApiResponse<{ message: string }>> {
    return this.request('/auth/send-sms', {
      method: 'POST',
      body: JSON.stringify(input),
    }, false)
  }

  /** 获取当前用户信息 */
  async getMe(): Promise<ApiResponse<SafeUser>> {
    return this.request('/auth/me')
  }

  /** 更新用户信息 */
  async updateMe(input: UpdateUserInput): Promise<ApiResponse<SafeUser>> {
    return this.request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }

  /** 微信 OAuth 登录 */
  async wechatAuth(code: string, state?: string): Promise<ApiResponse<{ user: SafeUser; token: string }>> {
    const params = new URLSearchParams({ code })
    if (state) params.append('state', state)
    return this.request(`/auth/wechat-auth?${params}`, {}, false)
  }

  /** QQ OAuth 登录 */
  async qqAuth(code: string, state?: string): Promise<ApiResponse<{ user: SafeUser; token: string }>> {
    const params = new URLSearchParams({ code })
    if (state) params.append('state', state)
    return this.request(`/auth/qq-auth?${params}`, {}, false)
  }

  /** 修改密码 */
  async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    })
  }

  // ==================== Memoir APIs ====================

  /** 创建回忆录 */
  async createMemoir(input: CreateMemoirInput): Promise<ApiResponse<Memoir>> {
    return this.request('/memoir', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /** 获取回忆录列表 */
  async listMemoirs(params?: PaginationParams & { search?: string }): Promise<PaginatedResponse<Memoir>> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.search) query.set('search', params.search)
    const qs = query.toString()
    return this.request(`/memoir${qs ? `?${qs}` : ''}`)
  }

  /** 获取单个回忆录 */
  async getMemoir(id: string): Promise<ApiResponse<Memoir>> {
    return this.request(`/memoir/${id}`)
  }

  /** 更新回忆录 */
  async updateMemoir(id: string, input: UpdateMemoirInput): Promise<ApiResponse<Memoir>> {
    return this.request(`/memoir/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }

  /** 删除回忆录 */
  async deleteMemoir(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/memoir/${id}`, { method: 'DELETE' })
  }

  // ==================== Draft APIs ====================

  /** 保存草稿 */
  async saveDraft(input: SaveDraftInput): Promise<ApiResponse<MemoirDraft>> {
    return this.request('/memoir/draft', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /** 获取草稿列表 */
  async listDrafts(): Promise<ApiResponse<MemoirDraft[]>> {
    return this.request('/memoir/draft')
  }

  /** 获取单个草稿 */
  async getDraft(id: string): Promise<ApiResponse<MemoirDraft>> {
    return this.request(`/memoir/draft/${id}`)
  }

  /** 删除草稿 */
  async deleteDraft(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/memoir/draft/${id}`, { method: 'DELETE' })
  }

  // ==================== Gallery APIs ====================

  /** 创建画廊条目 */
  async createGallery(input: CreateGalleryInput): Promise<ApiResponse<GalleryItem>> {
    return this.request('/memoir/gallery', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /** 获取画廊列表 */
  async listGallery(params?: PaginationParams): Promise<PaginatedResponse<GalleryItem>> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return this.request(`/memoir/gallery${qs ? `?${qs}` : ''}`)
  }

  /** 获取单个照片 */
  async getGalleryItem(id: string): Promise<ApiResponse<GalleryItem>> {
    return this.request(`/memoir/gallery/${id}`)
  }

  /** 更新画廊条目 */
  async updateGallery(id: string, input: Partial<CreateGalleryInput>): Promise<ApiResponse<GalleryItem>> {
    return this.request(`/memoir/gallery/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }

  /** 删除画廊条目 */
  async deleteGallery(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/memoir/gallery/${id}`, { method: 'DELETE' })
  }

  /** 评论照片 */
  async commentPhoto(photoId: string, content: string): Promise<ApiResponse<PhotoComment>> {
    return this.request(`/memoir/gallery/${photoId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }

  /** 获取照片评论 */
  async getPhotoComments(photoId: string): Promise<ApiResponse<PhotoComment[]>> {
    return this.request(`/memoir/gallery/${photoId}/comment`)
  }

  /** 分享照片 */
  async sharePhoto(photoId: string): Promise<ApiResponse<PhotoShareToken>> {
    return this.request(`/memoir/gallery/${photoId}/share`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  /** 通过分享 Token 获取照片 */
  async getSharedPhoto(token: string): Promise<ApiResponse<GalleryItem>> {
    return this.request(`/shared/photo/${token}`, {}, false)
  }

  // ==================== Friend APIs ====================

  /** 创建好友 */
  async createFriend(input: CreateFriendInput): Promise<ApiResponse<Friend>> {
    return this.request('/friend', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /** 获取好友列表 */
  async listFriends(params?: { category?: string; search?: string } & PaginationParams): Promise<PaginatedResponse<Friend>> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.category) query.set('category', params.category)
    if (params?.search) query.set('search', params.search)
    const qs = query.toString()
    return this.request(`/friend${qs ? `?${qs}` : ''}`)
  }

  /** 获取单个好友 */
  async getFriend(id: string): Promise<ApiResponse<Friend>> {
    return this.request(`/friend/${id}`)
  }

  /** 更新好友 */
  async updateFriend(id: string, input: UpdateFriendInput): Promise<ApiResponse<Friend>> {
    return this.request(`/friend/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }

  /** 删除好友 */
  async deleteFriend(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/friend/${id}`, { method: 'DELETE' })
  }

  // ==================== Family APIs ====================

  /** 获取家族树 */
  async getFamilyTree(): Promise<ApiResponse<Friend[]>> {
    return this.request('/family')
  }

  // ==================== Hobby APIs ====================

  /** 创建爱好 */
  async createHobby(input: CreateHobbyInput): Promise<ApiResponse<Hobby>> {
    return this.request('/hobby', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /** 获取爱好列表 */
  async listHobbies(params?: { category?: string } & PaginationParams): Promise<PaginatedResponse<Hobby>> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.category) query.set('category', params.category)
    const qs = query.toString()
    return this.request(`/hobby${qs ? `?${qs}` : ''}`)
  }

  /** 删除爱好 */
  async deleteHobby(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/hobby/${id}`, { method: 'DELETE' })
  }

  // ==================== AI APIs ====================

  /** AI 对话 */
  async chat(input: ChatInput): Promise<ApiResponse<{ reply: string; done: boolean }>> {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /** 生成回忆录故事 */
  async generateStory(messages: ChatMessage[]): Promise<ApiResponse<{ story: string }>> {
    return this.request('/ai/generate-story', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    })
  }

  /** 获取访谈维度 */
  async getInterviewDimensions(): Promise<ApiResponse<InterviewDimension[]>> {
    return this.request('/ai/dimensions')
  }

  /** Agent 对话 (SSE) */
  async agentChat(messages: ChatMessage[]): Promise<ApiResponse<{ reply: string }>> {
    return this.request('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    })
  }

  // ==================== Capture APIs ====================

  /** 获取采集会话列表 */
  async listCaptureSessions(params?: { type?: 'photo' | 'video' } & PaginationParams): Promise<PaginatedResponse<CaptureSession>> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.type) query.set('type', params.type)
    const qs = query.toString()
    return this.request(`/capture${qs ? `?${qs}` : ''}`)
  }

  // ==================== Search APIs ====================

  /** 全局搜索 */
  async search(query: string): Promise<ApiResponse<SearchResult[]>> {
    return this.request(`/search?q=${encodeURIComponent(query)}`)
  }

  // ==================== Notification APIs ====================

  /** 获取通知列表 */
  async listNotifications(params?: PaginationParams): Promise<PaginatedResponse<Notification>> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return this.request(`/notifications${qs ? `?${qs}` : ''}`)
  }

  /** 标记通知已读 */
  async markNotificationRead(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/notifications/${id}/read`, { method: 'POST' })
  }

  /** 未读通知数 */
  async unreadNotificationCount(): Promise<ApiResponse<{ count: number }>> {
    return this.request('/notifications/unread-count')
  }

  // ==================== Bookmark APIs ====================

  /** 获取收藏列表 */
  async listBookmarks(params?: PaginationParams): Promise<PaginatedResponse<Bookmark>> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return this.request(`/bookmarks${qs ? `?${qs}` : ''}`)
  }

  /** 添加收藏 */
  async addBookmark(targetType: string, targetId: string): Promise<ApiResponse<Bookmark>> {
    return this.request('/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId }),
    })
  }

  /** 取消收藏 */
  async removeBookmark(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/bookmarks/${id}`, { method: 'DELETE' })
  }

  // ==================== Reminder APIs ====================

  /** 获取提醒列表 */
  async listReminders(): Promise<ApiResponse<Reminder[]>> {
    return this.request('/reminders')
  }

  /** 创建提醒 */
  async createReminder(input: Partial<Reminder>): Promise<ApiResponse<Reminder>> {
    return this.request('/reminders', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /** 删除提醒 */
  async deleteReminder(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/reminders/${id}`, { method: 'DELETE' })
  }

  // ==================== Emergency APIs ====================

  /** 获取紧急联系人列表 */
  async listEmergencyContacts(): Promise<ApiResponse<EmergencyContact[]>> {
    return this.request('/emergency')
  }

  /** 创建紧急联系人 */
  async createEmergencyContact(input: Partial<EmergencyContact>): Promise<ApiResponse<EmergencyContact>> {
    return this.request('/emergency', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  // ==================== OSS APIs ====================

  /** 获取 OSS 上传签名 */
  async getOSSUploadSign(key: string, contentType?: string): Promise<ApiResponse<{ url: string }>> {
    return this.request('/oss/sign', {
      method: 'POST',
      body: JSON.stringify({ key, contentType, method: 'PUT' }),
    })
  }

  /** 获取 OSS 下载签名 */
  async getOSSDownloadSign(key: string): Promise<ApiResponse<{ url: string }>> {
    return this.request('/oss/download', {
      method: 'POST',
      body: JSON.stringify({ key }),
    })
  }

  /** 删除 OSS 对象 */
  async deleteOSSObject(key: string): Promise<ApiResponse<{ message: string }>> {
    return this.request('/oss/delete', {
      method: 'POST',
      body: JSON.stringify({ key }),
    })
  }

  // ==================== Health ====================

  /** 健康检查 */
  async health(): Promise<ApiResponse<{ status: string; time: string; uptime: number; version: string }>> {
    return this.request('/health', {}, false)
  }
}

// ==================== Error ====================

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ==================== Factory ====================

/**
 * 创建忆往昔 API 客户端实例
 */
export function createMemoirClient(config: SDKConfig): MemoirClient {
  return new MemoirClient(config)
}
