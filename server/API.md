# 忆往昔回忆录助手 - API 文档

## 基础信息

- **Base URL**: `http://localhost:3002` (开发环境)
- **认证方式**: Bearer Token (JWT)
- **Content-Type**: `application/json`

## 认证

大多数API需要认证。在请求头中添加：
```
Authorization: Bearer <token>
```

获取token：通过 `/auth/register` 或 `/auth/login` 接口。

---

## 目录

1. [健康检查](#健康检查)
2. [认证接口](#认证接口)
3. [OSS接口](#oss接口)
4. [回忆录接口](#回忆录接口)
5. [好友接口](#好友接口)
6. [AI接口](#ai接口)
7. [电信平台接口](#电信平台接口)

---

## 健康检查

### GET /health

检查服务是否正常运行。

**响应示例:**
```json
{
  "status": "ok",
  "time": "2026-06-13T04:18:52.340Z",
  "uptime": 123.45
}
```

---

## 认证接口

### POST /auth/register

注册新用户。

**请求体:**
```json
{
  "username": "用户名",
  "email": "user@example.com",
  "password": "密码",
  "phone": "手机号(可选)"
}
```

**验证规则:**
- username: 2-20个字符
- email: 有效邮箱格式
- password: 至少6个字符
- phone: 可选，格式为1[3-9]d{9}

**响应示例:**
```json
{
  "user": {
    "id": "...",
    "username": "...",
    "email": "...",
    "avatar": null
  },
  "token": "..."
}
```

### POST /auth/login

用户登录。

**请求体:**
```json
{
  "account": "用户名或邮箱",
  "password": "密码"
}
```

**响应示例:** 同注册接口

### GET /auth/me

获取当前登录用户信息（需要认证）。

**响应示例:** 同注册接口

### POST /auth/send-sms

发送短信验证码。

**请求体:**
```json
{
  "phone": "手机号"
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "验证码已发送"
}
```

### POST /auth/phone-login

手机号验证码登录。

**请求体:**
```json
{
  "phone": "手机号",
  "code": "验证码"
}
```

**响应示例:** 同注册接口

### GET /auth/wechat-auth

获取微信登录授权URL。

**响应示例:**
```json
{
  "authUrl": "https://open.weixin.qq.com/..."
}
```

### GET /auth/qq-auth

获取QQ登录授权URL。

**响应示例:** 同微信登录

---

## OSS接口

所有OSS接口需要认证。

### POST /oss/sign

获取OSS上传签名。

**请求体:**
```json
{
  "filename": "文件名",
  "contentType": "文件类型"
}
```

**响应示例:**
```json
{
  "url": "...",
  "key": "...",
  "policy": "...",
  ...
}
```

### GET /oss/list

列出OSS文件列表。

**查询参数:**
- `prefix`: 文件前缀（可选）

**响应示例:**
```json
{
  "files": [...]
}
```

### DELETE /oss/delete

删除OSS文件。

**请求体:**
```json
{
  "key": "文件key"
}
```

**响应示例:**
```json
{
  "success": true
}
```

---

## 回忆录接口

所有回忆录接口需要认证。

### GET /memoir

获取所有回忆录。

**响应示例:**
```json
{
  "memoirs": [
    {
      "id": "...",
      "title": "...",
      "content": "...",
      "tags": ["标签1", "标签2"],
      "mood": "心情",
      "location": "地点",
      "date": "2026-06-13",
      "media": ["oss-key-1", "oss-key-2"],
      "isPublished": true,
      "createdAt": "2026-06-13T04:18:52.340Z",
      "updatedAt": "2026-06-13T04:18:52.340Z"
    }
  ]
}
```

### GET /memoir/:id

获取单个回忆录详情。

**响应示例:** 同获取所有回忆录（单个对象）

### POST /memoir

创建新回忆录。

**请求体:**
```json
{
  "title": "标题(必填)",
  "content": "内容",
  "date": "2026-06-13(必填)",
  "tags": ["标签1"],
  "mood": "心情",
  "location": "地点",
  "media": ["oss-key-1"]
}
```

**响应示例:** 同获取单个回忆录

### PUT /memoir/:id

更新回忆录。

**请求体:** 同创建回忆录（所有字段可选）

**响应示例:** 同获取单个回忆录

### DELETE /memoir/:id

删除回忆录。

**响应示例:**
```json
{
  "success": true
}
```

### GET /memoir/draft

获取所有草稿。

**响应示例:**
```json
{
  "drafts": [
    {
      "id": "...",
      "title": "...",
      "content": "...",
      "tags": ["标签1"],
      "mood": "心情",
      "date": "2026-06-13",
      "media": ["oss-key-1"],
      "createdAt": "2026-06-13T04:18:52.340Z",
      "updatedAt": "2026-06-13T04:18:52.340Z"
    }
  ]
}
```

### POST /memoir/draft

保存草稿（更新或创建）。

**请求体:**
```json
{
  "id": "草稿ID(更新时提供)",
  "title": "标题",
  "content": "内容",
  "tags": ["标签1"],
  "mood": "心情",
  "date": "2026-06-13",
  "media": ["oss-key-1"]
}
```

**响应示例:** 同获取所有草稿（单个对象）

### DELETE /memoir/draft/:id

删除草稿。

**响应示例:**
```json
{
  "success": true
}
```

### GET /memoir/gallery

获取画廊列表。

**响应示例:**
```json
{
  "gallery": [
    {
      "id": "...",
      "memoirId": "...",
      "ossKey": "...",
      "caption": "描述",
      "tags": ["标签1"],
      "date": "2026-06-13",
      "createdAt": "2026-06-13T04:18:52.340Z"
    }
  ]
}
```

### POST /memoir/gallery

添加画廊图片。

**请求体:**
```json
{
  "ossKey": "OSS文件key(必填)",
  "caption": "描述",
  "tags": ["标签1"],
  "date": "2026-06-13(必填)",
  "memoirId": "关联的回忆录ID"
}
```

**响应示例:** 同获取画廊列表（单个对象）

### DELETE /memoir/gallery/:id

删除画廊图片。

**响应示例:**
```json
{
  "success": true
}
```

---

## 好友接口

所有好友接口需要认证。

### GET /friend

获取所有好友（可按category过滤）。

**查询参数:**
- `category`: 好友分类 (`family` | `class_mate` | `friend`)

**响应示例:**
```json
{
  "friends": [
    {
      "id": "...",
      "name": "好友姓名",
      "avatar": "头像URL",
      "addedAt": "2026-06-13T04:18:52.340Z",
      "category": "family",
      "relationship": "父亲",
      "generation": 1,
      "parentId": "父节点ID",
      "spouseId": "配偶ID",
      "school": "学校名称",
      "classInfo": "班级信息",
      "graduationYear": "毕业年份",
      "metAt": "认识地点",
      "metYear": "认识年份",
      "tags": ["工作单位", "兴趣组"],
      "createdAt": "2026-06-13T04:18:52.340Z",
      "updatedAt": "2026-06-13T04:18:52.340Z"
    }
  ]
}
```

### GET /friend/:id

获取单个好友详情。

**响应示例:** 同获取所有好友（单个对象）

### POST /friend

添加好友。

**请求体:**
```json
{
  "name": "姓名(必填)",
  "category": "family|class_mate|friend(必填)",
  "avatar": "头像URL",
  "relationship": "关系",
  "generation": 1,
  "parentId": "父节点ID",
  "spouseId": "配偶ID",
  "school": "学校",
  "classInfo": "班级",
  "graduationYear": "毕业年份",
  "metAt": "认识地点",
  "metYear": "认识年份",
  "tags": ["标签1"]
}
```

**generation说明:**
- `+2,+3,+4`: 祖辈
- `+1`: 父辈
- `0`: 同辈
- `-1,-2,-3`: 子、孙辈

**响应示例:** 同获取单个好友

### PUT /friend/:id

更新好友信息。

**请求体:** 同添加好友（所有字段可选）

**响应示例:** 同获取单个好友

### DELETE /friend/:id

删除好友。

**响应示例:**
```json
{
  "success": true
}
```

---

## AI接口

所有AI接口需要认证。

### POST /ai/interview

AI采访生成回忆录内容。

**请求体:**
```json
{
  "topic": "采访主题",
  "answers": ["回答1", "回答2"]
}
```

**响应示例:**
```json
{
  "content": "生成的回忆录内容..."
}
```

---

## 电信平台接口

### POST /telecom/token

交换电信平台Token。

**请求体:**
```json
{
  "code": "授权码"
}
```

**响应示例:**
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  ...
}
```

---

## 错误响应格式

所有错误响应都遵循以下格式：

```json
{
  "success": false,
  "error": "错误信息",
  "code": "错误代码(可选)",
  "details": "详细错误信息(可选)",
  "requestId": "请求ID"
}
```

**常见错误代码:**
- `VALIDATION_ERROR`: 验证错误
- `AUTH_ERROR`: 认证错误
- `FORBIDDEN_ERROR`: 权限错误
- `NOT_FOUND`: 资源不存在
- `CONFLICT_ERROR`: 数据冲突
- `RATE_LIMIT_ERROR`: 请求过于频繁
- `INTERNAL_ERROR`: 服务器内部错误

---

## 分页（待实现）

部分列表接口支持分页，通过查询参数：
- `page`: 页码（从1开始）
- `limit`: 每页数量

**分页响应格式:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 版本历史

- **v1.0.0** (2026-06-13): 初始API文档
