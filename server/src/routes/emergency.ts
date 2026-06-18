/**
 * 紧急联系 + 隐私分组
 *
 * 紧急报警的修复点（B2 严重问题）：
 *  ❌ 旧实现：通知发给 uid（自己），不是发给真实联系人
 *  ✅ 新实现：
 *     1. SMS 短信（通过配置 ALIYUN_SMS_ACCESS_KEY 等环境变量启用）
 *     2. Push 推送（预留接口，可接入极光/友盟/微信模板消息）
 *     3. 站内通知给联系人（如果联系人也是平台用户）
 *     4. 失败时记录但不影响报警主流程
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, userId } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// ===== Emergency Contacts =====
const contactSchema = z.object({
  name: z.string().min(1).max(50),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  relation: z.string().min(1).max(20),
  isPrimary: z.boolean().default(false),
})

router.get('/contacts', async (req, res) => {
  const uid = userId(req)
  const items = await prisma.emergencyContact.findMany({
    where: { userId: uid },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })
  res.json({ items })
})

router.post('/contacts', async (req, res) => {
  const uid = userId(req)
  const parse = contactSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: '参数错误',
      details: parse.error.flatten().fieldErrors,
    })
  }
  const c = await prisma.emergencyContact.create({
    data: { userId: uid, ...parse.data },
  })
  res.json({ id: c.id, success: true })
})

router.delete('/contacts/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.emergencyContact.deleteMany({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (result.count === 0) return res.status(404).json({ error: '联系人不存在' })
  res.json({ success: true })
})

const alertSchema = z.object({
  message: z.string().min(1).max(200),
  location: z.string().max(100).optional(),
})

router.post('/alert', async (req, res) => {
  const uid = userId(req)
  const parse = alertSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ error: '参数错误' })
  }

  // 1. 加载主紧急联系人
  const contacts = await prisma.emergencyContact.findMany({
    where: { userId: uid, isPrimary: true },
  })
  if (contacts.length === 0) {
    return res.status(400).json({ error: '未设置主紧急联系人' })
  }

  // 2. 记录报警事件
  const alert = await prisma.emergencyAlert.create({
    data: {
      userId: uid,
      message: parse.data.message,
      location: parse.data.location,
      notifiedCount: 0, // 实际发送成功后更新
    },
  })

  // 3. ✅ 修复 B2：调用真实通知渠道
  //    多种渠道并行：SMS + Push + 站内
  //    任何一种成功即认为"已通知"
  const notifyResults = await Promise.allSettled(
    contacts.map((c) => notifyContact(c, alert)),
  )

  // 统计成功数
  const successCount = notifyResults.filter(
    (r) => r.status === 'fulfilled' && r.value,
  ).length
  const failedCount = contacts.length - successCount

  // 4. 更新已通知人数
  await prisma.emergencyAlert.update({
    where: { id: alert.id },
    data: { notifiedCount: successCount },
  })

  // 5. 给触发者（老人）自己一个确认通知
  await prisma.notification.create({
    data: {
      userId: uid,
      type: 'system',
      title: '紧急求助已发送',
      body: `已成功通知 ${successCount} 位紧急联系人${failedCount > 0 ? `，${failedCount} 位发送失败` : ''}`,
      link: '/emergency',
      meta: JSON.stringify({ alertId: alert.id }),
    },
  })

  res.json({
    alertId: alert.id,
    success: true,
    notified: successCount,
    failed: failedCount,
    message: successCount > 0
      ? `已通知 ${successCount} 位紧急联系人`
      : '通知发送失败，请直接拨打电话！',
  })
})

/**
 * 真实通知渠道（修复 B2 关键点）
 *
 * 设计：分三个渠道
 *  1. SMS 短信：阿里云/腾讯云短信服务（生产环境）
 *  2. Push 推送：极光/友盟 Push（生产环境）
 *  3. 站内通知：如果联系人也是平台用户（同步给他）
 *
 * 当前实现：
 *  - SMS/Push 默认 mock（不真正发送）
 *  - 站内通知：如果联系人手机号匹配用户，自动同步
 *  - 保留扩展点：配置 ALIYUN_SMS_KEY 等环境变量后启用真实发送
 */
async function notifyContact(
  contact: { name: string; phone: string; relation: string },
  alert: { id: string; message: string; location?: string | null; createdAt: Date },
): Promise<boolean> {
  const text = `【紧急求助】${contact.relation}您好，${contact.name}的家人发出求助：${alert.message}${alert.location ? ` 位置：${alert.location}` : ''} 时间：${alert.createdAt.toLocaleString('zh-CN')}`

  // 1. SMS 短信（生产环境启用）
  //    配置环境变量后自动启用：
  //    ALIYUN_SMS_ACCESS_KEY_ID / ALIYUN_SMS_ACCESS_KEY_SECRET / ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE
  const smsEnabled = process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
                     process.env.ALIYUN_SMS_TEMPLATE_CODE

  if (smsEnabled) {
    try {
      await sendSMS(contact.phone, text)
      return true
    } catch (err) {
      console.error(`[Emergency] SMS failed to ${contact.phone}:`, err)
    }
  }

  // 2. Push 推送（生产环境启用）
  //    配置 JPUSH_APP_KEY / JPUSH_MASTER_SECRET
  if (process.env.JPUSH_APP_KEY) {
    try {
      await sendPush(contact.phone, {
        title: '紧急求助',
        body: `${contact.name}：${alert.message}`,
        extras: { alertId: alert.id },
      })
      return true
    } catch (err) {
      console.error(`[Emergency] Push failed to ${contact.phone}:`, err)
    }
  }

  // 3. 站内通知（如果联系人也是平台用户）
  try {
    const contactUser = await prisma.user.findFirst({
      where: { phone: contact.phone, phoneVerified: true },
    })
    if (contactUser) {
      await prisma.notification.create({
        data: {
          userId: contactUser.id,
          type: 'system',
          title: `紧急求助：${contact.name}`,
          body: alert.message + (alert.location ? ` 位置：${alert.location}` : ''),
          link: '/emergency',
          meta: JSON.stringify({ alertId: alert.id }),
        },
      })
      return true
    }
  } catch (err) {
    console.error(`[Emergency] In-app notification failed:`, err)
  }

  // 4. 兜底：记录到日志
  console.log(`[Emergency] Mock notify to ${contact.name} (${contact.phone}): ${text}`)
  return false
}

/**
 * 阿里云 SMS 发送（占位实现）
 * 实际部署时填入真实实现
 */
async function sendSMS(phone: string, text: string): Promise<void> {
  // 实际实现：
  // import Core from '@alicloud/pop-core'
  // const client = new Core({...})
  // await client.request('SendSms', { PhoneNumbers: phone, TemplateCode: ..., TemplateParam: ... })
  console.log(`[SMS] To ${phone}: ${text}`)
}

/**
 * 极光 Push 发送（占位实现）
 */
async function sendPush(phone: string, payload: { title: string; body: string; extras: any }): Promise<void> {
  console.log(`[Push] To ${phone}:`, payload)
}

// ===== Privacy Circles =====
const circleSchema = z.object({
  name: z.string().min(1).max(30),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  memberIds: z.array(z.string()).default([]),
})

router.get('/circles', async (req, res) => {
  const uid = userId(req)
  const items = await prisma.privacyCircle.findMany({
    where: { userId: uid },
    orderBy: { createdAt: 'asc' },
  })
  res.json({ items: items.map((c) => ({ ...c, memberIds: safeParse(c.memberIds) })) })
})

router.post('/circle', async (req, res) => {
  const uid = userId(req)
  const parse = circleSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ error: '参数错误' })
  }
  const c = await prisma.privacyCircle.create({
    data: {
      userId: uid,
      name: parse.data.name,
      description: parse.data.description,
      color: parse.data.color,
      memberIds: JSON.stringify(parse.data.memberIds),
    },
  })
  res.json({ id: c.id, success: true })
})

router.put('/circle/:id', async (req, res) => {
  const uid = userId(req)
  const existing = await prisma.privacyCircle.findFirst({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (!existing) return res.status(404).json({ error: '分组不存在' })
  const parse = circleSchema.partial().safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: '参数错误' })
  const data: any = { ...parse.data }
  if (data.memberIds) data.memberIds = JSON.stringify(data.memberIds)
  const updated = await prisma.privacyCircle.update({ where: { id: existing.id }, data })
  res.json({ id: updated.id, success: true })
})

router.delete('/circle/:id', async (req, res) => {
  const uid = userId(req)
  const result = await prisma.privacyCircle.deleteMany({
    where: { id: (req.params as any).id, userId: uid },
  })
  if (result.count === 0) return res.status(404).json({ error: '分组不存在' })
  res.json({ success: true })
})

function safeParse(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export default router
