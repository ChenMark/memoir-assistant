/**
 * 忆往昔 (memoir-assistant) SDK
 * 
 * 统一导出入口 — 可通过子路径按需引入或全量引入
 * 
 * @example 全量引入
 * ```ts
 * import { MemoirClient, hashPassword, chat, createMemoirSchema } from '@memoir-assistant/sdk'
 * ```
 * 
 * @example 子路径引入
 * ```ts
 * import { MemoirClient } from '@memoir-assistant/sdk/client'
 * import { hashPassword, generateToken } from '@memoir-assistant/sdk/auth'
 * import { chat, INTERVIEW_DIMENSIONS } from '@memoir-assistant/sdk/ai'
 * ```
 */

// ==================== Types ====================
export type {
  // 用户
  User,
  SafeUser,
  JWTPayload,
  // AI
  ChatMessage,
  InterviewDimension,
  InterviewState,
  AgentTool,
  OpenAIFunction,
  // 搜索
  SearchResultType,
  SearchResult,
  // 核心实体
  Memoir,
  MemoirDraft,
  GalleryItem,
  PhotoComment,
  PhotoShareToken,
  Friend,
  FriendCategory,
  Hobby,
  HobbyCategory,
  CaptureSession,
  Notification,
  NotificationType,
  Bookmark,
  BookmarkType,
  Reminder,
  ReminderType,
  EmergencyContact,
  PrivacyCircle,
  // API
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  // OSS
  OSSConfig,
  OSSSignOptions,
  OSSClient,
  // SDK 配置
  SDKConfig,
} from './types/index.js'

// ==================== Auth ====================
export {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateSMSCode,
  generateSalt,
  sanitizeUser,
} from './auth/index.js'

// ==================== AI ====================
export {
  INTERVIEW_DIMENSIONS,
  chat,
  generateStory,
  getDimensions,
  getNextDimension,
  getSystemPrompt,
  type AIProvider,
} from './ai/index.js'

// ==================== Agent ====================
export {
  createAgentTools,
  toolsToOpenAIFunctions,
  executeTool,
  DEFAULT_TOOL_NAMES,
} from './agent/index.js'

// ==================== Search ====================
export {
  tokenize,
  matchScore,
  rankAndSlice,
  searchInDocuments,
  semanticSearch,
} from './search/index.js'

// ==================== OSS ====================
export {
  createOSSClient,
  uploadToPresignedUrl,
  generateOSSKey,
  extractFilename,
  validateFile,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  FILE_SIZE_LIMITS,
} from './oss/index.js'

// ==================== Validators ====================
export {
  // Schemas
  registerSchema,
  loginSchema,
  sendSMSSchema,
  phoneLoginSchema,
  updateUserSchema,
  createMemoirSchema,
  updateMemoirSchema,
  saveDraftSchema,
  createGallerySchema,
  chatSchema,
  generateStorySchema,
  createFriendSchema,
  updateFriendSchema,
  createHobbySchema,
  ossSignSchema,
  ossDownloadSchema,
  ossDeleteSchema,
  ossListSchema,
  paginationSchema,
  // Helpers
  validate,
  safeValidate,
} from './validators/index.js'

export type {
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
  GenerateStoryInput,
  CreateFriendInput,
  UpdateFriendInput,
  CreateHobbyInput,
  OSSSignInput,
  OSSDownloadInput,
  OSSDeleteInput,
  OSSListInput,
  PaginationInput,
} from './validators/index.js'

// ==================== Client ====================
export {
  MemoirClient,
  createMemoirClient,
  ApiError,
} from './client/index.js'
