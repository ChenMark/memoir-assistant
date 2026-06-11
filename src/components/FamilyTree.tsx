import { useMemo, useState, useRef } from 'react'
import { Friend } from '../utils/sdk'

interface FamilyTreeProps {
  friends: Friend[]
  onEdit?: (friend: Friend) => void
  onDelete?: (id: string) => void
}

/* ============ 布局常量 ============ */
const NODE_W = 116
const NODE_H = 56
const LEVEL_GAP = 100
const NODE_GAP = 16
const SPOUSE_GAP = 6
const FAMILY_GAP = 32
const PADDING_X = 50
const PADDING_Y = 36

/* ============ 主组件 ============ */
export default function FamilyTree({ friends, onEdit, onDelete }: FamilyTreeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => buildLayout(friends), [friends])

  const handleZoomIn = () => setZoom(z => Math.min(Number((z + 0.15).toFixed(2)), 2))
  const handleZoomOut = () => setZoom(z => Math.max(Number((z - 0.15).toFixed(2)), 0.4))
  const handleResetZoom = () => setZoom(1)

  if (friends.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)', fontSize: 14 }}>
        还没有家族成员，点击「添加」开始构建家族树
      </div>
    )
  }

  const scale = zoom
  const scaledW = Math.max(layout.canvasW * scale, 400)
  const scaledH = Math.max(layout.canvasH * scale, 200)

  return (
    <div style={{ position: 'relative' }}>
      {/* 缩放控件 */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)',
        borderRadius: 8, padding: '4px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid var(--border)'
      }}>
        <button onClick={handleZoomOut} style={zoomBtnStyle} title="缩小">－</button>
        <span style={{ fontSize: 12, fontWeight: 500, minWidth: 42, textAlign: 'center', color: 'var(--text)' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={handleZoomIn} style={zoomBtnStyle} title="放大">＋</button>
        <button onClick={handleResetZoom} style={{ ...zoomBtnStyle, fontSize: 11 }} title="重置">重置</button>
      </div>

      <div ref={containerRef} style={{
        overflow: 'auto',
        borderRadius: 'var(--radius)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow)',
        padding: 12,
        border: '1px solid var(--border)'
      }}>
        <div style={{
          width: scaledW,
          height: scaledH,
          position: 'relative',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}>
          {/* SVG 连线层 */}
          <svg
            width={layout.canvasW}
            height={layout.canvasH}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}
          >
            {/* 配偶连线 */}
            {layout.spouseEdges.map((edge, i) => (
              <line
                key={`s-${i}`}
                x1={edge.x1} y1={edge.y1}
                x2={edge.x2} y2={edge.y2}
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="4 3"
                opacity={0.7}
              />
            ))}
            {/* 亲子连线 */}
            {layout.parentEdges.map((edge, i) => (
              <path
                key={`p-${i}`}
                d={edge.path}
                stroke="#c4b5fd"
                strokeWidth={2}
                fill="none"
                opacity={0.55}
              />
            ))}
          </svg>

          {/* 节点层 */}
          {layout.nodes.map(node => (
            <NodeCard
              key={node.friend.id}
              node={node}
              isSelected={selectedId === node.friend.id}
              onSelect={() => setSelectedId(selectedId === node.friend.id ? null : node.friend.id)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>

      {/* 图例 */}
      <div style={{
        display: 'flex', gap: 16, marginTop: 12, fontSize: 12,
        color: 'var(--text-secondary)', flexWrap: 'wrap', alignItems: 'center'
      }}>
        <span> 共 {friends.length} 位家族成员</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 16, height: 2, background: '#c4b5fd', borderRadius: 1, display: 'inline-block' }} />
          亲子关系
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 16, borderBottom: '2px dashed #a78bfa', display: 'inline-block' }} />
          配偶关系
        </span>
        <span>· 滚轮缩放 / 拖拽平移</span>
      </div>
    </div>
  )
}

/* ============ 节点卡片组件 ============ */
function NodeCard({
  node,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  node: LayoutNode
  isSelected: boolean
  onSelect: () => void
  onEdit?: (friend: Friend) => void
  onDelete?: (id: string) => void
}) {
  const hasSpouse = !!node.friend.spouseId

  return (
    <div
      onClick={onSelect}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_W,
        height: NODE_H,
        background: isSelected
          ? 'linear-gradient(135deg, #ede9fe, #fae8ff)'
          : 'linear-gradient(135deg, #faf5ff, #fdf4ff)',
        border: isSelected ? '2px solid #7c3aed' : hasSpouse ? '1.5px solid #d8b4fe' : '1px solid #e9d5ff',
        borderRadius: 10,
        padding: '6px 8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        zIndex: 1,
        boxShadow: isSelected
          ? '0 4px 16px rgba(124,58,237,0.25)'
          : '0 2px 6px rgba(0,0,0,0.05)',
        transform: isSelected ? 'scale(1.04)' : 'scale(1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.12)'
          e.currentTarget.style.borderColor = '#c4b5fd'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)'
          e.currentTarget.style.borderColor = hasSpouse ? '#d8b4fe' : '#e9d5ff'
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* 头像 */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: node.friend.spouseId
            ? 'linear-gradient(135deg, #a855f7, #ec4899)'
            : 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 12, fontWeight: 600, flexShrink: 0,
        }}>
          {node.friend.avatar
            ? <img src={node.friend.avatar} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
            : node.friend.name.charAt(0)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: '#1e1b4b',
            lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {node.friend.name}
          </div>
          {node.friend.relationship && (
            <div style={{ fontSize: 10.5, color: '#7c3aed', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.friend.relationship}
              {node.friend.spouseId && ' · 有配偶'}
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮（选中时显示） */}
      {isSelected && (onEdit || onDelete) && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center' }}>
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(node.friend) }}
              style={actionBtnStyle('#7c3aed')}>
              编辑
            </button>
          )}
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(node.friend.id) }}
              style={actionBtnStyle('#c62828')}>
              删除
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ============ 样式辅助 ============ */
const zoomBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6,
  border: '1px solid var(--border)', background: '#fff',
  color: 'var(--text)', fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, lineHeight: 1,
}

const actionBtnStyle = (bg: string): React.CSSProperties => ({
  padding: '2px 10px', fontSize: 11, background: bg, color: '#fff',
  border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500,
})

/* ============ 类型定义 ============ */
interface LayoutNode {
  friend: Friend
  x: number
  y: number
}

interface SpouseEdge {
  x1: number; y1: number
  x2: number; y2: number
}

interface ParentEdge {
  path: string
}

interface LayoutResult {
  nodes: LayoutNode[]
  spouseEdges: SpouseEdge[]
  parentEdges: ParentEdge[]
  canvasW: number
  canvasH: number
}

/* ============ 核心布局算法 ============ */
function buildLayout(friends: Friend[]): LayoutResult {
  if (friends.length === 0) {
    return { nodes: [], spouseEdges: [], parentEdges: [], canvasW: 400, canvasH: 200 }
  }

  const idMap = new Map(friends.map(f => [f.id, f]))
  const gens = friends.map(f => f.generation ?? 0)
  const minGen = Math.min(...gens)
  const maxGen = Math.max(...gens)

  /* ---- 1. 按 generation 分组 ---- */
  const byGen = new Map<number, Friend[]>()
  friends.forEach(f => {
    const g = f.generation ?? 0
    if (!byGen.has(g)) byGen.set(g, [])
    byGen.get(g)!.push(f)
  })

  /* ---- 2. 计算 Y 坐标 ---- */
  const nodeY = new Map<string, number>()
  friends.forEach(f => {
    nodeY.set(f.id, (f.generation! - minGen) * LEVEL_GAP + PADDING_Y)
  })

  /* ---- 3. 辅助函数 ---- */
  const getChildren = (parentId: string) => friends.filter(c => c.parentId === parentId)
  const getSpouse = (f: Friend) => f.spouseId ? idMap.get(f.spouseId) : undefined
  const spouseOf = (f: Friend) => f.spouseId || undefined

  /* ---- 4. 分配 X 坐标（从底向上） ---- */
  const nodeX = new Map<string, number>()

  // 从最底层（晚辈）往上处理
  for (let g = maxGen; g >= minGen; g--) {
    const nodes = byGen.get(g) || []

    // 4a. 先为有孩子的节点分配 x（基于孩子的中心）
    nodes.forEach(f => {
      if (nodeX.has(f.id)) return  // 已处理（如配偶已设置）

      const children = getChildren(f.id)
      if (children.length > 0) {
        const childXs = children.map(c => nodeX.get(c.id)).filter((v): v is number => v !== undefined)
        if (childXs.length > 0) {
          const minCx = Math.min(...childXs)
          const maxCx = Math.max(...childXs)
          const childrenCenter = (minCx + maxCx + NODE_W) / 2
          nodeX.set(f.id, childrenCenter - NODE_W / 2)
        }
      }
    })

    // 4b. 为配偶分配位置（排在已分配节点的右侧）
    nodes.forEach(f => {
      const spouse = getSpouse(f)
      if (spouse && nodeX.has(f.id) && !nodeX.has(spouse.id)) {
        nodeX.set(spouse.id, nodeX.get(f.id)! + NODE_W + SPOUSE_GAP)
      }
    })

    // 4c. 为没有孩子的节点分配位置
    const unplaced = nodes.filter(f => !nodeX.has(f.id))
    if (unplaced.length > 0) {
      // 将未放置节点按 parentId 分组（兄弟姐妹在一起）
      const siblingGroups = new Map<string | undefined, Friend[]>()
      unplaced.forEach(f => {
        const key = f.parentId
        if (!siblingGroups.has(key)) siblingGroups.set(key, [])
        siblingGroups.get(key)!.push(f)
      })

      // 计算该层已有节点的最右位置
      const placedXs = nodes.filter(f => nodeX.has(f.id)).map(f => {
        const x = nodeX.get(f.id)!
        const w = NODE_W + (getSpouse(f) && nodeX.has(getSpouse(f)!.id) ? NODE_W + SPOUSE_GAP : 0)
        return x + w
      })
      let cursorX = placedXs.length > 0 ? Math.max(...placedXs) + FAMILY_GAP : PADDING_X

      // 先排有 parent 的组（兄弟姐妹）
      siblingGroups.forEach((group, parentId) => {
        if (parentId === undefined) return
        group.forEach(f => {
          nodeX.set(f.id, cursorX)
          cursorX += NODE_W + NODE_GAP
        })
        cursorX += FAMILY_GAP - NODE_GAP
      })

      // 再排没有 parent 的独立节点
      const orphans = siblingGroups.get(undefined) || []
      orphans.forEach(f => {
        nodeX.set(f.id, cursorX)
        cursorX += NODE_W + NODE_GAP
      })
    }
  }

  /* ---- 5. 碰撞检测与调整 ---- */
  for (let g = minGen; g <= maxGen; g++) {
    const nodes = byGen.get(g) || []

    // 计算每个节点及其配偶的占据范围
    const ranges = nodes
      .filter(f => nodeX.has(f.id))
      .map(f => {
        const sx = nodeX.get(f.id)!
        const spouse = getSpouse(f)
        const hasSp = spouse && nodeX.has(spouse.id)
        const sw = hasSp ? nodeX.get(spouse.id)! - sx + NODE_W : NODE_W
        return { f, x: sx, width: sw, right: sx + sw }
      })
      .sort((a, b) => a.x - b.x)

    // 从左到右检查重叠
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1]
      const curr = ranges[i]
      if (curr.x < prev.right + NODE_GAP) {
        const shift = prev.right + NODE_GAP - curr.x

        // 右移当前节点
        curr.x += shift
        nodeX.set(curr.f.id, curr.x)
        curr.right = curr.x + curr.width
        ranges[i].x = curr.x
        ranges[i].right = curr.right

        // 如果当前节点有配偶在右侧，配偶的x会自动跟着变（因为x是连续的）
        // 不需要额外处理，因为width已经包含了配偶

        // 右移该节点的整个子树
        shiftSubtree(curr.f.id, shift, nodeX, friends, byGen)
      }
    }
  }

  /* ---- 6. 构建 LayoutNode 列表 ---- */
  const layoutNodes: LayoutNode[] = friends.map(f => ({
    friend: f,
    x: nodeX.get(f.id) ?? PADDING_X,
    y: nodeY.get(f.id) ?? PADDING_Y,
  }))

  /* ---- 7. 构建连线 ---- */
  const spouseEdges: SpouseEdge[] = []
  const parentEdges: ParentEdge[] = []

  // 配偶连线
  friends.forEach(f => {
    if (f.spouseId && nodeX.has(f.id) && nodeX.has(f.spouseId)) {
      const sx = nodeX.get(f.id)! + NODE_W
      const sy = nodeY.get(f.id)! + NODE_H / 2
      const ex = nodeX.get(f.spouseId)!
      const ey = nodeY.get(f.spouseId)! + NODE_H / 2
      if (sx < ex) {  // 只画一次（从左到右）
        spouseEdges.push({ x1: sx, y1: sy, x2: ex, y2: ey })
      }
    }
  })

  // 亲子连线
  friends.forEach(f => {
    if (!f.parentId) return
    const parent = idMap.get(f.parentId)
    if (!parent || !nodeX.has(f.parentId) || !nodeX.has(f.id)) return

    const px = nodeX.get(f.parentId)! + NODE_W / 2
    const py = nodeY.get(f.parentId)! + NODE_H
    const cx = nodeX.get(f.id)! + NODE_W / 2
    const cy = nodeY.get(f.id)!

    // 如果父节点有配偶，连线从夫妻中点出发
    let startX = px
    if (parent.spouseId && nodeX.has(parent.spouseId)) {
      const spouseX = nodeX.get(parent.spouseId)!
      startX = (px + spouseX + NODE_W / 2) / 2
    }

    // 贝塞尔曲线
    const midY = (py + cy) / 2
    const d = `M${startX},${py} C${startX},${midY} ${cx},${midY} ${cx},${cy}`
    parentEdges.push({ path: d })
  })

  /* ---- 8. 画布尺寸 ---- */
  const allXs = Array.from(nodeX.values())
  const allYs = Array.from(nodeY.values())
  const maxX = allXs.length > 0 ? Math.max(...allXs) : 0
  const maxY = allYs.length > 0 ? Math.max(...allYs) : 0
  const canvasW = Math.max(400, maxX + NODE_W + PADDING_X)
  const canvasH = Math.max(200, maxY + NODE_H + PADDING_Y)

  return { nodes: layoutNodes, spouseEdges, parentEdges, canvasW, canvasH }
}

/* ---- 右移整个子树 ---- */
function shiftSubtree(
  rootId: string,
  shift: number,
  nodeX: Map<string, number>,
  friends: Friend[],
  byGen: Map<number, Friend[]>
) {
  const root = friends.find(f => f.id === rootId)
  if (!root) return
  const rootGen = root.generation ?? 0

  // 收集所有后代
  const descendantIds = new Set<string>()
  const queue = [rootId]
  while (queue.length > 0) {
    const pid = queue.shift()!
    const children = friends.filter(f => f.parentId === pid)
    children.forEach(c => {
      if (!descendantIds.has(c.id)) {
        descendantIds.add(c.id)
        queue.push(c.id)
      }
    })
  }

  // 右移根节点、配偶、所有后代
  const toShift = new Set([rootId, ...descendantIds])
  if (root.spouseId) toShift.add(root.spouseId)

  // 还要移后代们的配偶
  descendantIds.forEach(id => {
    const f = friends.find(x => x.id === id)
    if (f?.spouseId) toShift.add(f.spouseId)
  })

  toShift.forEach(id => {
    if (nodeX.has(id)) {
      nodeX.set(id, nodeX.get(id)! + shift)
    }
  })
}
