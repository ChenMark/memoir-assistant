# OSS 到 SQLite 数据迁移指南

本目录包含从阿里云 OSS 迁移数据到 SQLite 数据库的脚本。

## 功能说明

迁移脚本可以将以下数据从 OSS 迁移到 SQLite：
- 用户数据（users/users.json）
- 回忆录数据（memoirs/{userId}/{memoirId}.json）
- 草稿数据（drafts/{userId}/{draftId}.json）
- 画廊数据（galleries/{userId}/{galleryId}.json）

## 使用步骤

### 1. 配置 OSS 访问凭证

复制示例配置文件并填写实际配置：

```bash
cp .env.migrate.example .env.migrate
```

编辑 `.env.migrate` 文件，填写你的 OSS 配置：
- `OSS_ACCESS_KEY_ID`: 阿里云 Access Key ID
- `OSS_ACCESS_KEY_SECRET`: 阿里云 Access Key Secret
- `OSS_BUCKET`: OSS Bucket 名称
- `OSS_REGION`: OSS Region（如 oss-cn-hangzhou）
- `OSS_ENDPOINT`: OSS Endpoint（如 oss-cn-hangzhou.aliyuncs.com）

### 2. 确保数据库已初始化

如果还没有初始化数据库，请先运行：

```bash
npx prisma migrate dev
```

### 3. 运行迁移脚本

```bash
node scripts/migrate-from-oss.js
```

脚本会按顺序迁移数据，并显示进度和结果。

### 4. 验证迁移结果

迁移完成后，可以通过以下方式验证：

```bash
# 使用 Prisma Studio 查看数据
npx prisma studio
```

或者在应用中测试功能是否正常。

## 注意事项

1. **备份数据**：在运行迁移之前，建议先备份 OSS 数据和现有的 SQLite 数据库。
2. **测试环境**：建议先在测试环境运行迁移脚本，确认无误后再在生产环境执行。
3. **幂等性**：脚本会尝试创建记录，如果记录已存在会报错。可以清空数据库后重新运行。
4. **错误处理**：脚本会记录失败的项目，但不会中断整个过程。请检查错误日志。

## 故障排除

### 问题：OSS 配置错误

**错误信息**：`OSS 配置不完整`

**解决方法**：检查 `.env.migrate` 文件是否填写正确，确保 OSS 凭证有效。

### 问题：数据库连接失败

**错误信息**：`Can't reach database server`

**解决方法**：检查 `DATABASE_URL` 配置，确保 SQLite 数据库文件存在。

### 问题：某些记录迁移失败

**现象**：脚本显示某些记录创建失败

**解决方法**：检查错误日志，确认 OSS 中的数据格式是否正确。可以手动修复数据后重新运行脚本。

## 脚本说明

### 文件结构

- `scripts/migrate-from-oss.js`: 主迁移脚本
- `.env.migrate.example`: 配置示例文件
- `.env.migrate`: 实际配置文件（不应提交到 Git）

### 核心函数

- `migrateUsers()`: 迁移用户数据
- `migrateMemoirs()`: 迁移回忆录数据
- `migrateDrafts()`: 迁移草稿数据
- `migrateGalleries()`: 迁移画廊数据

### 自定义修改

如果需要修改迁移逻辑（如数据格式转换），请编辑 `scripts/migrate-from-oss.js` 文件中的相应函数。

## 后续步骤

数据迁移完成后，建议执行以下操作：

1. **测试应用功能**：确保所有功能正常工作
2. **清理 OSS 数据**（可选）：如果确认迁移成功，可以备份并清理 OSS 中的旧数据
3. **更新部署配置**：确保生产环境使用新的 SQLite 数据库（或迁移到 PostgreSQL）

## 联系方式

如果遇到问题，请联系开发团队。
