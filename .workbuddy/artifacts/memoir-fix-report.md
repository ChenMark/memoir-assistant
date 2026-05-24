# 忆往昔回忆录助手 — 三大短板修复报告

**时间**: 2026-05-24  
**修复人**: 锋 ⚡

---

## 一、云存储缺失 → 已补全

### 修复前
- `sdk.ts` 中 `OSSStorageService` 只定义了类，但 **从未被任何组件实际调用**
- `Drafts.tsx` 纯 `localStorage`，换设备丢失
- `Gallery.tsx` 用 `simulateCloudAuth()` 假装上传（2 秒延迟返回假 URL）
- `Friends.tsx` 备份只支持本地 JSON 下载

### 修复后
| 组件 | 改动 |
|------|------|
| `App.tsx` | 将 `sdk` 实例挂到 `window._memoirSDK`，全局可访问 `sdk.storage` |
| `sdk.ts` | 新增 `getDownloadUrl()`、`downloadObjectContent()` 方法到 `OSSStorageService` |
| `Drafts.tsx` | 保存时自动同步 OSS + localStorage 双写；加载时优先读 OSS → 降级 localStorage |
| `Gallery.tsx` | 上传照片→生成缩略图→同步 OSS；`simulateCloudAuth` 替换为真实 `sdk.storage.upload()` |
| `Friends.tsx` | 新增「云端备份」「云端恢复」按钮，数据存入 `memoir/backup/` 目录 |
| `server/src/index.ts` | 新增 `POST /oss/download` 端点（生成 presigned 下载 URL） |
| `.env.example` | 补全 `VITE_OSS_DELETE_ENDPOINT`、`VITE_OSS_STS_ENDPOINT` |

### 安全策略
- 前端 **绝不持有** `AccessKeyId`/`AccessKeySecret`
- 上传走 `POST /oss/sign` → 后端生成 presigned PUT URL → 前端直传 OSS
- 下载走 `POST /oss/download` → 后端生成 presigned GET URL → 前端 fetch
- 删除走 `DELETE /oss/delete` → 后端代理删除

---

## 二、安全细节补强

### 签名升级
| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 签名算法 | 仅 MD5（已实现但未暴露切换） | HMAC-SHA256 优先，MD5 降级兼容 |
| 签名模式控制 | 无 | `VITE_TELECOM_SIGN_MODE=hmac\|md5` |
| 签名校验工具 | 无 | 新增 `verifyRequestSignature()` 导出函数（供后端/协作端使用） |

### 新增导出
```typescript
export function verifyRequestSignature(
  params: Record<string, string>,
  receivedSign: string,
  appSecret: string,
  mode: 'hmac' | 'md5' = 'hmac'
): boolean
```

### 身份证加密
- `aesEncrypt`/`aesDecrypt` (AES-256-CBC) 已在之前补丁中实现
- `VITE_ENCRYPT_KEY` 通过 env 注入，绝不硬编码

---

## 三、UI 占位模块填充

### 修复前（假数据/假功能）
| 模块 | 问题 |
|------|------|
| `Dashboard.tsx` | `syncStatus: 85`、`totalWords: 12450`、`progress: 45` 全部硬编码 |
| `Gallery.tsx` | `simulateCloudAuth()` — 2 秒假延迟返回假 URL |
| `Friends.tsx` | 只有本地备份，无云端能力 |

### 修复后
| 模块 | 改动 |
|------|------|
| `Dashboard.tsx` | `getStats()` 从 localStorage 实时读取草稿字数/章节数/照片数；云同步状态根据 `sdk.storage` 是否可用动态计算（可用=100%，未同步=50%，不可用=0%）；5 秒轮询 + focus 事件自动刷新 |
| `Gallery.tsx` | `simulateCloudAuth()` 彻底移除，替换为真实 OSS presign 上传流程 |
| `Friends.tsx` | 4 按钮布局（本地恢复/本地备份/云端备份/云端恢复），云端数据存入 `memoir/backup/` |

---

## 构建验证

```
npx vite build
✓ 1803 modules transformed.
dist/index.html                   1.52 kB
dist/assets/index-BHiKz16_.css    0.86 kB
dist/assets/index-wl9PdFNP.js   679.82 kB
✓ built in 2.13s
```

---

## 待办
- [ ] 启动后端 `cd server && npm install && npm run dev` 后填入真实 OSS 凭证
- [ ] 将 `VITE_OSS_SIGN_ENDPOINT` 填入 `.env.local`
- [ ] 后端部署后测试端到端上传/下载/删除流程
