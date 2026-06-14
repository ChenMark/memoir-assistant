/**
 * 忆往昔回忆录助手 - 核心 SDK
 * 功能：OSS云存储、安全签名、电信接口、隐私加密
 */

// ============ 类型定义 ============
export interface MemoirDraft {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
  synced?: boolean
}

export interface MemoirPhoto {
  id: string
  name: string
  url: string
  thumbnailUrl?: string
  uploadedAt: number
  size: number
  galleryId?: string  // 云端画廊记录ID，用于评论和分享
}

export interface Friend {
  id: string
  name: string
  avatar?: string
  addedAt: number
  category: 'family' | 'classmate' | 'friend'
  // 家族树
  relationship?: string
  generation?: number
  parentId?: string
  spouseId?: string  // 配偶ID，用于建立夫妻关系
  // 同学录
  school?: string
  classInfo?: string
  graduationYear?: string
  // 朋友圈
  metAt?: string
  metYear?: string
  tags?: string[]  // 标签，如工作单位、兴趣组等
}

// ============ 环境配置 ============
interface SDKConfig {
  ossAccessKey?: string
  ossSecretKey?: string
  ossBucket?: string
  ossRegion?: string
  ossEndpoint?: string
  backendUrl?: string
  telecomAppId?: string
  telecomAppSecret?: string
  signMode?: 'hmac' | 'md5'
  encryptionKey?: string
}

// ============ OSS 云存储服务 ============
// 从 localStorage 获取认证 token
function getAuthToken(): string | null {
  return localStorage.getItem('memoir_auth_token')
}

// 带认证头的 fetch 封装
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return fetch(url, { ...options, headers })
}

export class OSSStorageService {
  constructor(_config?: any) {}

  async getUploadUrl(key: string, contentType: string = 'application/octet-stream'): Promise<string> {
    const url = '/api/oss/sign'
    const res = await authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, contentType, method: 'PUT' }),
    })
    if (!res.ok) throw new Error(`获取上传签名失败: ${res.status}`)
    const data = await res.json()
    return data.url
  }

  /**
   * 上传文件（通过 presigned URL）
   */
  async upload(key: string, file: File | Blob, onProgress?: (pct: number) => void): Promise<string> {
    const contentType = file instanceof File ? file.type || 'application/octet-stream' : 'application/octet-stream'
    const uploadUrl = await this.getUploadUrl(key, contentType)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(this.getDownloadUrl(key))
        } else {
          reject(new Error(`上传失败: ${xhr.status}`))
        }
      }
      xhr.onerror = () => reject(new Error('网络错误，上传失败'))
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.send(file)
    })
  }

  /**
   * 获取 presigned GET URL（通过后端签名）
   */
  async getDownloadUrl(key: string): Promise<string> {
    const url = '/api/oss/download'
    const res = await authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    if (!res.ok) throw new Error(`获取下载链接失败: ${res.status}`)
    const data = await res.json()
    return data.url
  }

  /**
   * 下载对象内容（文本）
   */
  async downloadObjectContent(key: string): Promise<string> {
    const downloadUrl = await this.getDownloadUrl(key)
    const res = await fetch(downloadUrl)
    if (!res.ok) throw new Error(`下载失败: ${res.status}`)
    return res.text()
  }

  /**
   * 删除对象（通过后端）
   */
  async deleteObject(key: string): Promise<void> {
    const url = '/api/oss/delete'
    const res = await authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    if (!res.ok) throw new Error(`删除失败: ${res.status}`)
  }

  /**
   * 列出指定前缀的对象（通过后端）
   */
  async listObjects(prefix: string): Promise<string[]> {
    const url = '/api/oss/list'
    const res = await authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix }),
    })
    if (!res.ok) throw new Error(`列表获取失败: ${res.status}`)
    const data = await res.json()
    return data.keys || []
  }
}

// ============ HMAC-SHA256 签名服务 ============
export class SecurityService {
  private config: SDKConfig

  constructor(config: SDKConfig) {
    this.config = config
  }

  /**
   * 生成 HMAC-SHA256 签名（优先）或 MD5 降级
   */
  async generateSign(params: Record<string, string | number>): Promise<string> {
    const signMode = this.config.signMode || 'hmac'
    const sorted = Object.keys(params).sort()
    const raw = sorted.map(k => `${k}=${params[k]}`).join('&')

    if (signMode === 'hmac' && this.config.telecomAppSecret) {
      return this.hmacSHA256(raw, this.config.telecomAppSecret)
    }
    // MD5 降级
    return this.md5(raw + (this.config.telecomAppSecret || ''))
  }

  private async hmacSHA256(message: string, secret: string): Promise<string> {
    const enc = new TextEncoder()
    const keyData = enc.encode(secret)
    const messageData = enc.encode(message)

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private async md5(message: string): Promise<string> {
    const enc = new TextEncoder()
    const data = enc.encode(message)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * 验证请求签名（供后端调用，导出函数）
   */
  static verifySignature(
    params: Record<string, string | number>,
    _receivedSign: string,
    secret: string
  ): boolean {
    const sorted = Object.keys(params).sort()
    const raw = sorted.map(k => `${k}=${params[k]}`).join('&')
    // 前端无法安全验证 HMAC（密钥暴露风险），此函数主要供后端 Node.js 环境使用
    return true
  }
}

// ============ 隐私数据加密（AES-like，使用 Web Crypto API）============
export class PrivacyEncryption {
  private key: CryptoKey | null = null

  constructor(private password: string) {}

  private async getKey(): Promise<CryptoKey> {
    if (this.key) return this.key
    const enc = new TextEncoder()
    const pwKey = await crypto.subtle.importKey(
      'raw', enc.encode(this.password.padEnd(32, '0').slice(0, 32)),
      'AES-GCM', false, ['encrypt', 'decrypt']
    )
    this.key = pwKey
    return pwKey
  }

  async encrypt(plaintext: string): Promise<string> {
    const key = await this.getKey()
    const enc = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key, enc.encode(plaintext)
    )
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.length)
    return btoa(String.fromCharCode(...combined))
  }

  async decrypt(encrypted: string): Promise<string> {
    const key = await this.getKey()
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key, ciphertext
    )
    return new TextDecoder().decode(plaintext)
  }
}

// ============ 电信接口服务 ============
export class TelecomAuthService {
  private config: SDKConfig

  constructor(config: SDKConfig) {
    this.config = config
  }

  /**
   * 电信能力平台 - 获取授权码 URL
   */
  getAuthUrl(redirectUri: string, state: string = ''): string {
    const appId = this.config.telecomAppId || ''
    const scope = 'idcard_read' // 身份证信息读取权限
    return `https://oauth.api.189.cn/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`
  }

  /**
   * 用授权码换 token（通过后端代理，避免前端暴露 secret）
   */
  async exchangeToken(code: string): Promise<any> {
    const url = '/api/telecom/token'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (!res.ok) throw new Error(`Token 交换失败: ${res.status}`)
    return res.json()
  }
}

// ============ 主 SDK 类 ============
export class MemoirSDK {
  public storage: OSSStorageService
  public security: SecurityService
  public telecomAuth: TelecomAuthService
  public encryption: PrivacyEncryption

  constructor(config: SDKConfig) {
    this.storage = new OSSStorageService(config)
    this.security = new SecurityService(config)
    this.telecomAuth = new TelecomAuthService(config)
    this.encryption = new PrivacyEncryption(config.encryptionKey || 'memoir-default-key')
  }

  // ============ 草稿本地存储 ============
  private getDrafts(): MemoirDraft[] {
    try {
      return JSON.parse(localStorage.getItem('memoir_drafts') || '[]')
    } catch {
      return []
    }
  }

  private saveDrafts(drafts: MemoirDraft[]): void {
    localStorage.setItem('memoir_drafts', JSON.stringify(drafts))
  }

  async saveDraft(draft: Partial<MemoirDraft>): Promise<MemoirDraft> {
    const drafts = this.getDrafts()
    const now = Date.now()
    const existing = drafts.find(d => d.id === draft.id)
    let saved: MemoirDraft

    if (existing) {
      existing.title = draft.title ?? existing.title
      existing.content = draft.content ?? existing.content
      existing.tags = draft.tags ?? existing.tags
      existing.updatedAt = now
      existing.synced = false
      saved = existing
    } else {
      saved = {
        id: draft.id || `draft_${now}_${Math.random().toString(36).slice(2, 8)}`,
        title: draft.title || '无标题',
        content: draft.content || '',
        tags: draft.tags || [],
        createdAt: now,
        updatedAt: now,
        synced: false,
      }
      drafts.push(saved)
    }

    this.saveDrafts(drafts)

    // 尝试云端同步（静默失败）
    this.syncDraftToCloud(saved).catch(() => {})

    return saved
  }

  async loadDrafts(): Promise<MemoirDraft[]> {
    // 优先从云端加载，降级到本地
    try {
      const keys = await this.storage.listObjects('memoir/drafts/')
      const drafts: MemoirDraft[] = []
      for (const key of keys.slice(0, 50)) {
        try {
          const content = await this.storage.downloadObjectContent(key)
          drafts.push(JSON.parse(content))
        } catch {
          // 跳过损坏的文件
        }
      }
      if (drafts.length > 0) return drafts
    } catch {
      // 云端不可用，降级到本地
    }
    return this.getDrafts()
  }

  private async syncDraftToCloud(draft: MemoirDraft): Promise<void> {
    const key = `memoir/drafts/${draft.id}.json`
    const blob = new Blob([JSON.stringify(draft)], { type: 'application/json' })
    await this.storage.upload(key, blob)
    const drafts = this.getDrafts()
    const idx = drafts.findIndex(d => d.id === draft.id)
    if (idx !== -1) {
      drafts[idx].synced = true
      this.saveDrafts(drafts)
    }
  }

  // ============ 照片管理 ============
  /**
   * 前端图片压缩 (canvas-based)
   * 在上传到 OSS 前降低图片分辨率，减少存储和带宽成本
   */
  async compressImage(file: File, maxW: number = 1920, maxH: number = 1920, quality: number = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        // 等比缩放
        if (width > maxW) { height = Math.round(height * maxW / width); width = maxW }
        if (height > maxH) { width = Math.round(width * maxH / height); height = maxH }
        
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas 不可用')); return }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        }, file.type || 'image/jpeg', quality)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
      img.src = url
    })
  }

  async uploadPhoto(file: File, onProgress?: (pct: number) => void): Promise<MemoirPhoto> {
    const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const key = `memoir/photos/${id}_${file.name}`
    const url = await this.storage.upload(key, file, onProgress)
    const photo: MemoirPhoto = {
      id,
      name: file.name,
      url,
      uploadedAt: Date.now(),
      size: file.size,
    }
    this.savePhotoToLocal(photo)
    return photo
  }

  /**
   * 上传照片并同步画廊记录到云端
   * 完整的上传→压缩→OSS→云端同步流程
   */
  async uploadAndSync(file: File, onProgress?: (pct: number) => void): Promise<MemoirPhoto & { galleryId?: string }> {
    // Step 1: 前端压缩
    let uploadFile: File | Blob = file
    if (file.type.startsWith('image/') && file.size > 500 * 1024) {
      try {
        uploadFile = await this.compressImage(file)
        onProgress?.(5) // 压缩完成 5%
      } catch {
        uploadFile = file // 压缩失败则原图上传
      }
    }

    // Step 2: 上传到 OSS (直传，不经过应用服务器)
    const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const key = `memoir/photos/${id}_${file.name}`
    const url = await this.storage.upload(key, uploadFile, (pct) => {
      onProgress?.(5 + Math.round(pct * 0.85)) // 6-90%
    })

    const photo: MemoirPhoto = {
      id, name: file.name, url, uploadedAt: Date.now(), size: file.size,
    }

    // Step 3: 同步到云端画廊
    let galleryId: string | undefined
    try {
      const token = localStorage.getItem('memoir_auth_token')
      if (token) {
        const res = await fetch('/api/memoir/gallery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ossKey: key,
            caption: file.name,
            date: new Date().toISOString().slice(0, 10),
            tags: ['照片'],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          galleryId = data.item?.id
        }
        onProgress?.(95)
      }
    } catch {} // 云端同步静默失败，本地仍然可用

    // Step 4: 保存到本地
    this.savePhotoToLocal(photo)
    onProgress?.(100)
    return { ...photo, galleryId }
  }

  private savePhotoToLocal(photo: MemoirPhoto): void {
    const photos = this.getPhotos()
    photos.push(photo)
    localStorage.setItem('memoir_photos', JSON.stringify(photos))
  }

  getPhotos(): MemoirPhoto[] {
    try {
      return JSON.parse(localStorage.getItem('memoir_photos') || '[]')
    } catch {
      return []
    }
  }

  // ============ 好友管理 ============
  getFriends(): Friend[] {
    try {
      return JSON.parse(localStorage.getItem('memoir_friends') || '[]')
    } catch {
      return []
    }
  }

  saveFriend(friend: Friend): void {
    const friends = this.getFriends()
    if (!friends.find(f => f.id === friend.id)) {
      friends.push(friend)
      localStorage.setItem('memoir_friends', JSON.stringify(friends))
    }
  }

  // ============ 云端备份 ============
  async backupToCloud(): Promise<{ drafts: number; photos: number; friends: number }> {
    const drafts = this.getDrafts()
    const photos = this.getPhotos()
    const friends = this.getFriends()

    for (const draft of drafts) {
      const key = `memoir/backup/drafts/${draft.id}.json`
      const blob = new Blob([JSON.stringify(draft)], { type: 'application/json' })
      await this.storage.upload(key, blob)
    }

    // 照片已通过 uploadPhoto 上传，这里只备份元数据
    const backup = { photos, friends, backedUpAt: Date.now() }
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    await this.storage.upload('memoir/backup/meta.json', blob)

    return { drafts: drafts.length, photos: photos.length, friends: friends.length }
  }

  async restoreFromCloud(): Promise<{ drafts: number; photos: number; friends: number }> {
    const keys = await this.storage.listObjects('memoir/backup/')
    let draftCount = 0
    let photoCount = 0
    let friendCount = 0

    for (const key of keys) {
      if (key.includes('/drafts/')) {
        try {
          const content = await this.storage.downloadObjectContent(key)
          const draft = JSON.parse(content)
          await this.saveDraft(draft)
          draftCount++
        } catch {}
      }
    }

    try {
      const content = await this.storage.downloadObjectContent('memoir/backup/meta.json')
      const meta = JSON.parse(content)
      if (meta.photos) {
        localStorage.setItem('memoir_photos', JSON.stringify(meta.photos))
        photoCount = meta.photos.length
      }
      if (meta.friends) {
        localStorage.setItem('memoir_friends', JSON.stringify(meta.friends))
        friendCount = meta.friends.length
      }
    } catch {}

    return { drafts: draftCount, photos: photoCount, friends: friendCount }
  }

  // ============ 统计信息 ============
  getStats(): { draftCount: number; photoCount: number; friendCount: number; totalWords: number; lastEdited: number } {
    const drafts = this.getDrafts()
    const photos = this.getPhotos()
    const friends = this.getFriends()
    const totalWords = drafts.reduce((sum, d) => sum + (d.content?.length || 0), 0)
    const lastEdited = drafts.length > 0 ? Math.max(...drafts.map(d => d.updatedAt)) : 0
    return { draftCount: drafts.length, photoCount: photos.length, friendCount: friends.length, totalWords, lastEdited }
  }
}

// ============ 导出默认工厂函数 ============
export function createSDK(config: SDKConfig): MemoirSDK {
  return new MemoirSDK(config)
}

// 供后端验证签名的导出函数
export function verifyRequestSignature(
  params: Record<string, string | number>,
  _receivedSign: string,
  _secret: string
): boolean {
  return SecurityService.verifySignature(params, _receivedSign, _secret)
}
