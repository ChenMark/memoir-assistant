import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function UserManagement() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const maskPhone = (phone?: string) => {
    if (!phone) return null
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }

  if (!user) return null

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>👤 账户管理</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>

        {/* 用户信息卡片 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            {/* 头像 */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #b8860b, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 32, fontWeight: 700, flexShrink: 0,
            }}>
              {user.avatar ? (
                <img src={user.avatar} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                (user.username || user.email).charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{user.username}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{user.email}</div>
              {user.phone && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                   {maskPhone(user.phone)} {user.phoneVerified && <span style={{ color: 'var(--success)', fontSize: 11 }}>✓ 已验证</span>}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                注册于 {formatDate(user.createdAt)}
              </div>
            </div>
          </div>

          {/* 用户详情 */}
          <div style={{
            background: 'var(--bg)', borderRadius: 8, padding: 16,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>用户 ID</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{user.id}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>用户名</div>
              <div style={{ fontSize: 14 }}>{user.username}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>邮箱</div>
              <div style={{ fontSize: 14 }}>{user.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>手机号</div>
              <div style={{ fontSize: 14 }}>
                {user.phone ? `${maskPhone(user.phone)} ${user.phoneVerified ? '' : ''}` : '未绑定'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>注册时间</div>
              <div style={{ fontSize: 13 }}>{formatDate(user.createdAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>最后更新</div>
              <div style={{ fontSize: 13 }}>{formatDate(user.updatedAt)}</div>
            </div>
          </div>

          <button
            onClick={refreshUser}
            style={{
              marginTop: 16,
              padding: '6px 14px',
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
             刷新信息
          </button>
        </div>

        {/* 第三方账号绑定 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>🔗 第三方账号绑定</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 微信绑定状态 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#07c160">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348z"/>
                </svg>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>微信</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {user.wechatOpenId ? `已绑定 (${user.wechatNickname || '微信用户'})` : '未绑定'}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4, fontWeight: 500,
                color: user.wechatOpenId ? 'var(--success)' : 'var(--text-secondary)',
                background: user.wechatOpenId ? 'rgba(34,197,94,0.08)' : 'var(--bg)',
              }}>
                {user.wechatOpenId ? '✓ 已绑定' : '—'}
              </span>
            </div>

            {/* QQ绑定状态 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#12b7f5">
                  <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-2.234.689-.464.194-.69.776-.69 1.087 0 .312.22.49.498.49.236 0 4.194-1.185 8.946-1.185 4.752 0 8.946 1.185 8.946 1.185.278 0 .498-.178.498-.49 0-.311-.226-.893-.69-1.087-.463-.194-2.234-.689-2.234-.689 2.084-1.77 1.904-3.967 1.904-3.967.846 1.588 1.634 2.072 1.748 2.072.111 0 .281-.36.281-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.293 3.364 14.268 2 12.003 2z"/>
                </svg>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>QQ</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {user.qqOpenId ? `已绑定 (${user.qqNickname || 'QQ用户'})` : '未绑定'}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4, fontWeight: 500,
                color: user.qqOpenId ? 'var(--success)' : 'var(--text-secondary)',
                background: user.qqOpenId ? 'rgba(34,197,94,0.08)' : 'var(--bg)',
              }}>
                {user.qqOpenId ? '✓ 已绑定' : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* 安全设置 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}> 安全设置</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>登录密码</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>使用密码登录您的账户</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '4px 10px', borderRadius: 4 }}>
                已设置
              </span>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>手机绑定</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {user.phone ? `已绑定 ${maskPhone(user.phone)}` : '可绑定手机号以便通过短信登录'}
                </div>
              </div>
              <span style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4, fontWeight: 500,
                color: user.phoneVerified ? 'var(--success)' : 'var(--text-secondary)',
                background: user.phoneVerified ? 'rgba(34,197,94,0.08)' : 'var(--bg)',
              }}>
                {user.phone ? (user.phoneVerified ? '✓ 已验证' : '待验证') : '—'}
              </span>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>会话管理</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>当前设备登录中，token 有效期 7 天</div>
              </div>
              <span style={{
                fontSize: 11, color: 'var(--success)', background: 'rgba(34,197,94,0.08)',
                padding: '4px 10px', borderRadius: 4, fontWeight: 500,
              }}>
                🟢 活跃
              </span>
            </div>
          </div>
        </div>

        {/* 账户操作 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--danger)' }}> 账户操作</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{
                padding: '10px 24px',
                background: 'var(--danger)',
                color: '#fff',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              退出登录
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
            退出后需要重新登录才能访问您的数据
          </div>
        </div>
      </div>

      {/* 退出确认弹窗 */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius)',
            padding: 28, width: 360, maxWidth: '90vw', boxShadow: 'var(--shadow-lg)',
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>确认退出</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              确定要退出登录吗？退出后需要重新登录。
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  padding: '8px 20px',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                取消
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 20px',
                  background: 'var(--danger)',
                  color: '#fff',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
