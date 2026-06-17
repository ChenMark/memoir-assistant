/**
 * 忆往昔 App · 线性图标系统
 * 1.6px 描边 · currentColor 继承 · 跨平台一致
 */
import type { SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
  /** 语义化标签，屏读器读取 */
  title?: string
}

const base = (size = 22, p: IconProps): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': p.title ? undefined : true,
  role: p.title ? 'img' : 'presentation',
  ...p,
})

const T = (title: string | undefined) => title ? <title>{title}</title> : null

export const IconCamera = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M3 7h3l2-3h8l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

export const IconAgent = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M12 2l9 5v10l-9 5-9-5V7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

export const IconHobby = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)

export const IconGallery = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <rect x="3" y="3" width="14" height="14" rx="2"/>
    <path d="M7 7h6v6H7z"/>
    <path d="M14 14l3 3"/>
    <rect x="11" y="7" width="10" height="10" rx="2"/>
  </svg>
)

export const IconFamily = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <circle cx="9" cy="8" r="3"/>
    <circle cx="17" cy="9" r="2.5"/>
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
    <path d="M14 20c0-2.2 1.5-4 3-4s3 1.8 3 4"/>
  </svg>
)

export const IconMemoir = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M14 3v5h5"/>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5z"/>
    <path d="M9 13h6M9 17h4"/>
  </svg>
)

export const IconMusic = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
)

export const IconMovie = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <rect x="3" y="4" width="18" height="16" rx="2"/>
    <path d="M3 8h18M3 16h18M8 4v16M16 4v16"/>
  </svg>
)

export const IconInterview = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <path d="M8 9h8M8 13h5"/>
  </svg>
)

export const IconSettings = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

export const IconHome = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M3 12l9-9 9 9"/>
    <path d="M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10"/>
  </svg>
)

export const IconSearch = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <circle cx="11" cy="11" r="7"/>
    <path d="M21 21l-4.35-4.35"/>
  </svg>
)

export const IconPlus = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M12 5v14M5 12h14"/>
  </svg>
)

export const IconClose = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)

export const IconCheck = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M20 6L9 17l-5-5"/>
  </svg>
)

export const IconArrowRight = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)

export const IconChevronRight = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M9 6l6 6-6 6"/>
  </svg>
)

export const IconUpload = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <path d="M17 8l-5-5-5 5"/>
    <path d="M12 3v12"/>
  </svg>
)

export const IconDownload = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <path d="M7 10l5 5 5-5"/>
    <path d="M12 15V3"/>
  </svg>
)

export const IconTrash = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
)

export const IconEdit = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

export const IconPlay = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M5 3l14 9-14 9V3z"/>
  </svg>
)

export const IconStop = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <rect x="5" y="5" width="14" height="14" rx="1"/>
  </svg>
)

export const IconMic = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
  </svg>
)

export const IconSparkle = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
    <path d="M19 17l.5 1.5L21 19l-1.5.5L19 21l-.5-1.5L17 19l1.5-.5L19 17z"/>
  </svg>
)

export const IconRefresh = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8"/>
    <path d="M21 3v5h-5M3 21v-5h5"/>
  </svg>
)

export const IconUser = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <circle cx="12" cy="8" r="4"/>
    <path d="M3 21c0-4 4-7 9-7s9 3 9 7"/>
  </svg>
)

export const IconLogout = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <path d="M16 17l5-5-5-5M21 12H9"/>
  </svg>
)

export const IconCalendar = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M3 10h18M8 2v4M16 2v4"/>
  </svg>
)

export const IconClock = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 2"/>
  </svg>
)

export const IconAlert = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v4M12 16h.01"/>
  </svg>
)

export const IconBell = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10 21a2 2 0 0 0 4 0"/>
  </svg>
)

export const IconBookmark = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>
)

export const IconHeart = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)

export const IconShare = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <circle cx="18" cy="5" r="3"/>
    <circle cx="6" cy="12" r="3"/>
    <circle cx="18" cy="19" r="3"/>
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
  </svg>
)

export const IconFilter = ({ size, title, ...p }: IconProps) => (
  <svg {...base(size, p)}>{T(title)}
    <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/>
  </svg>
)
