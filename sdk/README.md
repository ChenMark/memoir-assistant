# @memoir-assistant/sdk

忆往昔回忆录助手 SDK — 类型定义、认证工具、AI 对话、Agent 工具、验证器、API 客户端。

## 安装

```bash
npm install @memoir-assistant/sdk
```

## 快速开始

### 1. API 客户端

```ts
import { createMemoirClient } from '@memoir-assistant/sdk'

const client = createMemoirClient({
  baseUrl: 'https://your-api.com',
  token: 'your-jwt-token',
})

// 获取用户信息
const { data: user } = await client.getMe()

// 创建回忆录
const { data: memoir } = await client.createMemoir({
  title: '我的童年',
  content: '小时候住在一条小河边...',
  date: '1990-06-15',
  tags: ['童年', '家乡'],
})

// AI 对话
const { data: chat } = await client.chat({
  messages: [{ role: 'user', content: '我想聊聊我的童年' }],
  dimensionId: 'childhood',
})
```

### 2. 认证工具

```ts
import { hashPassword, verifyPassword, generateToken } from '@memoir-assistant/sdk/auth'

// 密码哈希
const { hash, salt } = await hashPassword('my-password')

// 密码验证
const isValid = await verifyPassword('my-password', hash, salt)

// 生成 JWT
const token = generateToken(
  { id: '123', username: '张三', email: 'zhangsan@test.com' },
  'your-secret-key'
)
```

### 3. AI 对话

```ts
import { chat, INTERVIEW_DIMENSIONS, getDimensions } from '@memoir-assistant/sdk/ai'

// 获取所有10个访谈维度
const dims = getDimensions()
console.log(dims.map(d => d.name).join(', '))
// 童年记忆, 校园时光, 青春年华, ...

// 使用智能 Mock 对话
const { reply, done } = await chat(
  [{ role: 'user', content: '我小时候住在一个小镇上' }],
  'childhood'
)
```

### 4. Agent 工具

```ts
import { createAgentTools, toolsToOpenAIFunctions, executeTool } from '@memoir-assistant/sdk/agent'

const tools = createAgentTools({
  list_memoirs: async (args, userId) => { /* 实现 */ return '...' },
  search_memoirs: async (args, userId) => { /* 实现 */ return '...' },
  // ... 其他工具实现
})

// 转换为 OpenAI Function Calling 格式
const functions = toolsToOpenAIFunctions(tools)
```

### 5. 验证器

```ts
import { registerSchema, createMemoirSchema, validate } from '@memoir-assistant/sdk/validators'

// 校验注册输入
const regInput = validate(registerSchema, {
  username: '张三',
  email: 'test@example.com',
  password: '123456',
})

// 校验回忆录输入
const memoir = validate(createMemoirSchema, {
  title: '我的故事',
  date: '2024-01-01',
  content: '......',
})
```

### 6. 语义搜索

```ts
import { tokenize, searchInDocuments, rankAndSlice } from '@memoir-assistant/sdk/search'

// 中文分词
const tokens = tokenize('寻找童年的记忆')
// → ['童年', '年的', '年的记忆', '记忆', ...]

// 文档搜索
const results = searchInDocuments(
  '童年',
  documents,
  'memoir',
  (doc) => ({ title: doc.title, snippet: doc.content.slice(0, 100) })
)
```

### 7. OSS 客户端

```ts
import { createOSSClient, generateOSSKey, FILE_SIZE_LIMITS } from '@memoir-assistant/sdk/oss'

const oss = createOSSClient('https://your-api.com', 'token')

// 获取上传签名
const url = await oss.generateUploadUrl('photos/sunset.jpg', 'image/jpeg')

// 生成对象 Key
const key = generateOSSKey('user-123', 'photos', 'sunset.jpg')
// → 'memoir/user-123/photos/1718841600000_a3x9k2.jpg'
```

## 模块结构

```
@memoir-assistant/sdk
├── .          # 全量导出
├── /types     # 类型定义
├── /auth      # 认证工具 (密码哈希、JWT、盐值)
├── /ai        # AI 对话、回忆录引导、10维度100提示词
├── /agent     # Agent 工具注册表 (14个工具)
├── /search    # 语义搜索 (中文分词、模糊匹配)
├── /oss       # OSS 客户端 (签名、上传、验证)
├── /validators # Zod 验证 Schema (类型安全)
└── /client    # API 客户端 (fetch-based, 类型安全)
```

## 类型概览

| 类型 | 说明 |
|------|------|
| `User` / `SafeUser` | 用户信息 / 脱敏用户 |
| `Memoir` / `MemoirDraft` | 回忆录 / 草稿 |
| `GalleryItem` / `PhotoComment` | 画廊照片 / 评论 |
| `Friend` / `Hobby` | 亲友 / 爱好 |
| `ChatMessage` / `InterviewDimension` | AI 消息 / 访谈维度 |
| `SearchResult` / `Notification` | 搜索结果 / 通知 |
| `Bookmark` / `Reminder` | 收藏 / 提醒 |
| `EmergencyContact` / `PrivacyCircle` | 紧急联系人 / 隐私分组 |
| `ApiResponse<T>` / `PaginatedResponse<T>` | API 响应 / 分页响应 |

## License

MIT
