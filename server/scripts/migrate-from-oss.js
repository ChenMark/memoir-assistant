/**
 * OSS 到 SQLite 数据迁移脚本
 * 
 * 功能：从阿里云 OSS 读取现有的 JSON 数据文件，迁移到 SQLite 数据库
 * 
 * 使用方法：
 * 1. 配置环境变量（或创建 .env.migrate 文件）
 * 2. 运行脚本：node scripts/migrate-from-oss.js
 * 
 * 环境变量：
 * - OSS_ACCESS_KEY_ID: OSS Access Key ID
 * - OSS_ACCESS_KEY_SECRET: OSS Access Key Secret
 * - OSS_BUCKET: OSS Bucket 名称
 * - OSS_REGION: OSS Region（如 oss-cn-hangzhou）
 * - OSS_ENDPOINT: OSS Endpoint（如 oss-cn-hangzhou.aliyuncs.com）
 * - DATABASE_URL: SQLite 数据库路径（默认 file:./dev.db）
 */

const OSS = require('ali-oss')
const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')

// ============ 配置 ============

// 从环境变量或 .env 文件读取配置
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.migrate')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      const [key, ...values] = line.split('=')
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join('=').trim()
      }
    }
    console.log('✅ 已加载 .env.migrate 配置')
  }
}

loadEnv()

const OSS_CONFIG = {
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  bucket: process.env.OSS_BUCKET || '',
  region: process.env.OSS_REGION || '',
  endpoint: process.env.OSS_ENDPOINT || '',
}

const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db'

// ============ OSS 客户端 ============

let ossClient = null

function getOSSClient() {
  if (ossClient) return ossClient
  
  if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret || !OSS_CONFIG.bucket) {
    throw new Error('OSS 配置不完整，请检查环境变量或 .env.migrate 文件')
  }
  
  ossClient = new OSS({
    accessKeyId: OSS_CONFIG.accessKeyId,
    accessKeySecret: OSS_CONFIG.accessKeySecret,
    bucket: OSS_CONFIG.bucket,
    region: OSS_CONFIG.region,
    endpoint: OSS_CONFIG.endpoint,
  })
  
  return ossClient
}

// ============ OSS 数据读取 ============

async function listOSSObjects(prefix) {
  const client = getOSSClient()
  const objects = []
  let marker = null
  
  do {
    const result = await client.list({
      prefix,
      marker,
      'max-keys': 1000,
    }, {})
    
    if (result.objects) {
      objects.push(...result.objects)
    }
    
    marker = result.nextMarker
  } while (marker)
  
  return objects
}

async function getOSSObjectContent(key) {
  const client = getOSSClient()
  try {
    const result = await client.get(key)
    const content = result.content.toString('utf-8')
    return JSON.parse(content)
  } catch (err) {
    console.error(`❌ 读取 OSS 对象失败: ${key}`, err.message)
    return null
  }
}

// ============ 数据迁移函数 ============

const prisma = new PrismaClient()

async function migrateUsers() {
  console.log('\n📦 开始迁移用户数据...')
  
  // OSS 中的用户数据存储在 users/users.json
  const userData = await getOSSObjectContent('users/users.json')
  if (!userData) {
    console.log('⚠️  未找到用户数据 (users/users.json)')
    return
  }
  
  // userData 格式：{ [userId]: User }
  const users = Object.values(userData)
  console.log(`   找到 ${users.length} 个用户`)
  
  let successCount = 0
  let errorCount = 0
  
  for (const user of users) {
    try {
      await prisma.user.create({
        data: {
          id: user.id,
          email: user.email || '',
          username: user.username || user.email || `user_${user.id}`,
          passwordHash: user.passwordHash || '',
          salt: user.salt || '',
          phone: user.phone || null,
          phoneVerified: user.phoneVerified || false,
          avatar: user.avatar || null,
          bio: user.bio || null,
          wechatOpenId: user.wechatOpenId || null,
          wechatUnionId: user.wechatUnionId || null,
          wechatNickname: user.wechatNickname || null,
          qqOpenId: user.qqOpenId || null,
          qqNickname: user.qqNickname || null,
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
        }
      })
      successCount++
    } catch (err) {
      console.error(`   ❌ 创建用户失败: ${user.username || user.id}`, err.message)
      errorCount++
    }
  }
  
  console.log(`   ✅ 用户迁移完成: 成功 ${successCount}, 失败 ${errorCount}`)
}

async function migrateMemoirs() {
  console.log('\n📦 开始迁移回忆录数据...')
  
  // OSS 中的回忆录存储在 memoirs/{userId}/{memoirId}.json
  const objects = await listOSSObjects('memoirs/')
  console.log(`   找到 ${objects.length} 个回忆录文件`)
  
  let successCount = 0
  let errorCount = 0
  
  for (const obj of objects) {
    const memoir = await getOSSObjectContent(obj.name)
    if (!memoir) {
      errorCount++
      continue
    }
    
    try {
      await prisma.memoir.create({
        data: {
          id: memoir.id,
          userId: memoir.userId,
          title: memoir.title || '无标题',
          content: memoir.content || '',
          tags: JSON.stringify(memoir.tags || []),
          mood: memoir.mood || null,
          location: memoir.location || null,
          date: memoir.date || new Date().toISOString().split('T')[0],
          media: JSON.stringify(memoir.media || []),
          isPublished: memoir.isPublished !== false,
          createdAt: memoir.createdAt ? new Date(memoir.createdAt) : new Date(),
          updatedAt: memoir.updatedAt ? new Date(memoir.updatedAt) : new Date(),
        }
      })
      successCount++
    } catch (err) {
      console.error(`   ❌ 创建回忆录失败: ${memoir.title || memoir.id}`, err.message)
      errorCount++
    }
  }
  
  console.log(`   ✅ 回忆录迁移完成: 成功 ${successCount}, 失败 ${errorCount}`)
}

async function migrateDrafts() {
  console.log('\n📦 开始迁移草稿数据...')
  
  // OSS 中的草稿存储在 drafts/{userId}/{draftId}.json
  const objects = await listOSSObjects('drafts/')
  console.log(`   找到 ${objects.length} 个草稿文件`)
  
  let successCount = 0
  let errorCount = 0
  
  for (const obj of objects) {
    const draft = await getOSSObjectContent(obj.name)
    if (!draft) {
      errorCount++
      continue
    }
    
    try {
      await prisma.draft.create({
        data: {
          id: draft.id,
          userId: draft.userId,
          title: draft.title || '未命名草稿',
          content: draft.content || '',
          tags: JSON.stringify(draft.tags || []),
          mood: draft.mood || null,
          date: draft.date || null,
          media: JSON.stringify(draft.media || []),
          createdAt: draft.createdAt ? new Date(draft.createdAt) : new Date(),
          updatedAt: draft.updatedAt ? new Date(draft.updatedAt) : new Date(),
        }
      })
      successCount++
    } catch (err) {
      console.error(`   ❌ 创建草稿失败: ${draft.title || draft.id}`, err.message)
      errorCount++
    }
  }
  
  console.log(`   ✅ 草稿迁移完成: 成功 ${successCount}, 失败 ${errorCount}`)
}

async function migrateGalleries() {
  console.log('\n📦 开始迁移画廊数据...')
  
  // OSS 中的画廊存储在 galleries/{userId}/{galleryId}.json
  const objects = await listOSSObjects('galleries/')
  console.log(`   找到 ${objects.length} 个画廊文件`)
  
  let successCount = 0
  let errorCount = 0
  
  for (const obj of objects) {
    const gallery = await getOSSObjectContent(obj.name)
    if (!gallery) {
      errorCount++
      continue
    }
    
    try {
      await prisma.gallery.create({
        data: {
          id: gallery.id,
          userId: gallery.userId,
          memoirId: gallery.memoirId || null,
          ossKey: gallery.ossKey || '',
          caption: gallery.caption || '',
          tags: JSON.stringify(gallery.tags || []),
          date: gallery.date || new Date().toISOString().split('T')[0],
          createdAt: gallery.createdAt ? new Date(gallery.createdAt) : new Date(),
        }
      })
      successCount++
    } catch (err) {
      console.error(`   ❌ 创建画廊失败: ${gallery.id}`, err.message)
      errorCount++
    }
  }
  
  console.log(`   ✅ 画廊迁移完成: 成功 ${successCount}, 失败 ${errorCount}`)
}

// ============ 主函数 ============

async function main() {
  console.log('🚀 开始 OSS 到 SQLite 数据迁移...\n')
  console.log('配置信息:')
  console.log(`   OSS Bucket: ${OSS_CONFIG.bucket || '(未配置)'}`)
  console.log(`   OSS Region: ${OSS_CONFIG.region || '(未配置)'}`)
  console.log(`   Database: ${DATABASE_URL}`)
  console.log('')
  
  // 检查 OSS 配置
  if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret || !OSS_CONFIG.bucket) {
    console.error('❌ 错误: OSS 配置不完整')
    console.error('请创建 server/.env.migrate 文件并配置以下变量:')
    console.error('  OSS_ACCESS_KEY_ID=your_access_key_id')
    console.error('  OSS_ACCESS_KEY_SECRET=your_access_key_secret')
    console.error('  OSS_BUCKET=your_bucket_name')
    console.error('  OSS_REGION=oss-cn-hangzhou')
    console.error('  OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com')
    process.exit(1)
  }
  
  try {
    // 按顺序迁移数据
    await migrateUsers()
    await migrateMemoirs()
    await migrateDrafts()
    await migrateGalleries()
    
    console.log('\n🎉 数据迁移完成!')
  } catch (err) {
    console.error('\n❌ 迁移失败:', err.message)
    console.error(err.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行主函数
main().catch(console.error)
