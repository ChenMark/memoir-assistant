import { useMemo, useState } from 'react'
import { Friend } from '../utils/sdk'

interface FamilyTreeProps {
  friends: Friend[]
  onEdit?: (friend: Friend) => void
  onDelete?: (id: string) => void
}

const NODE_W = 130
const NODE_H = 68
const LEVEL_GAP = 110
const NODE_GAP = 24

export default function FamilyTree({ friends, onEdit, onDelete }: FamilyTreeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const tree = useMemo(() => buildTree(friends), [friends])

  if (friends.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)', fontSize: 14 }}>
         还没有家族成员，点击「添加」开始构建家族树
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto', borderRadius: 'var(--radius)', background: 'var(--bg-card)', boxShadow: 'var(--shadow)', padding: 16 }}>
      <div style={{ minWidth: tree.canvasW, minHeight: tree.canvasH, position: 'relative' }}>
        {/* SVG 连线 */}
        <svg width={tree.canvasW} height={tree.canvasH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
          {tree.edges.map((edge, i) => (
            <path
              key={i}
              d={`M${edge.x1},${edge.y1} C${edge.x1},${edge.y1 + 30} ${edge.x2},${edge.y2 - 30} ${edge.x2},${edge.y2}`}
              stroke="#c4b5fd"
              strokeWidth={2}
              fill="none"
              opacity={0.5}
            />
          ))}
        </svg>

        {/* 节点 */}
        {tree.nodes.map(node => (
          <div
            key={node.friend.id}
            onClick={() => setSelectedId(selectedId === node.friend.id ? null : node.friend.id)}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: NODE_W,
              background: selectedId === node.friend.id
                ? 'linear-gradient(135deg, #ede9fe, #fae8ff)'
                : 'linear-gradient(135deg, #faf5ff, #fdf4ff)',
              border: selectedId === node.friend.id ? '2px solid #7c3aed' : '1px solid #e9d5ff',
              borderRadius: 12,
              padding: '8px 10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              zIndex: 1,
              boxShadow: selectedId === node.friend.id ? '0 4px 16px rgba(124,58,237,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
              transform: selectedId === node.friend.id ? 'scale(1.05)' : 'scale(1)',
            }}
            onMouseEnter={e => {
              if (selectedId !== node.friend.id) {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.15)'
                e.currentTarget.style.borderColor = '#c4b5fd'
              }
            }}
            onMouseLeave={e => {
              if (selectedId !== node.friend.id) {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
                e.currentTarget.style.borderColor = '#e9d5ff'
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 头像 */}
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}>
                {node.friend.avatar
                  ? <img src={node.friend.avatar} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                  : node.friend.name.charAt(0)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.friend.name}</div>
                {node.friend.relationship && (
                  <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 1 }}>{node.friend.relationship}</div>
                )}
              </div>
            </div>
            {/* 操作按钮（选中时显示） */}
            {selectedId === node.friend.id && (onEdit || onDelete) && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {onEdit && (
                  <button onClick={e => { e.stopPropagation(); onEdit(node.friend) }}
                    style={{ padding: '2px 8px', fontSize: 11, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    
                  </button>
                )}
                {onDelete && (
                  <button onClick={e => { e.stopPropagation(); onDelete(node.friend.id) }}
                    style={{ padding: '2px 8px', fontSize: 11, background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
        <span> 共 {friends.length} 位家族成员</span>
        <span>· 点击节点查看操作</span>
        <span>· 曲线表示亲子关系</span>
      </div>
    </div>
  )
}

// ============ 树构建与布局 ============

interface LayoutNode {
  friend: Friend
  children: LayoutNode[]
  level: number
  x: number
  y: number
}

interface TreeResult {
  nodes: LayoutNode[]
  edges: { x1: number; y1: number; x2: number; y2: number }[]
  canvasW: number
  canvasH: number
}

function buildTree(friends: Friend[]): TreeResult {
  const idMap = new Map<string, Friend>()
  friends.forEach(f => idMap.set(f.id, f))

  // 找到根节点（没有 parentId 或 parent 不在列表里）
  const childIdSet = new Set(friends.filter(f => f.parentId && idMap.has(f.parentId)).map(f => f.id))
  const roots = friends.filter(f => !childIdSet.has(f.id))

  // BFS 构建树 + 计算 level
  const rootNodes: LayoutNode[] = roots.map(f => ({
    friend: f,
    children: [],
    level: f.generation ?? 0,
    x: 0, y: 0,
  }))

  const queue: LayoutNode[] = [...rootNodes]
  while (queue.length > 0) {
    const node = queue.shift()!
    const children = friends.filter(f => f.parentId === node.friend.id)
    node.children = children.map(c => ({
      friend: c,
      children: [],
      level: node.level + 1,
      x: 0, y: 0,
    }))
    queue.push(...node.children)
  }

  // 按 level 分组
  const levelMap = new Map<number, LayoutNode[]>()
  function collect(nodes: LayoutNode[]) {
    nodes.forEach(n => {
      const l = n.level
      if (!levelMap.has(l)) levelMap.set(l, [])
      levelMap.get(l)!.push(n)
      if (n.children.length > 0) collect(n.children)
    })
  }
  collect(rootNodes)

  const levels = Array.from(levelMap.entries()).sort((a, b) => a[0] - b[0])
  const minLevel = levels.length > 0 ? levels[0][0] : 0
  const maxLevel = levels.length > 0 ? levels[levels.length - 1][0] : 0

  // 计算每层的节点数，确定画布宽度
  const maxNodesPerLevel = Math.max(...levels.map(([, nodes]) => nodes.length), 1)
  const canvasW = Math.max(400, maxNodesPerLevel * (NODE_W + NODE_GAP) + 80)
  const canvasH = (maxLevel - minLevel + 1) * LEVEL_GAP + 80

  // 给每个节点分配位置（每层独立横向排列）
  const allNodes: LayoutNode[] = []
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []

  levels.forEach(([level, nodes]) => {
    const y = (level - minLevel) * LEVEL_GAP + 40
    const totalW = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP
    const startX = Math.max(40, (canvasW - totalW) / 2)
    nodes.forEach((node, i) => {
      const x = startX + i * (NODE_W + NODE_GAP)
      node.x = x
      node.y = y
      allNodes.push(node)
    })
  })

  // 收集边
  function collectEdges(nodes: LayoutNode[]) {
    nodes.forEach(n => {
      n.children.forEach(c => {
        edges.push({
          x1: n.x + NODE_W / 2,
          y1: n.y + NODE_H,
          x2: c.x + NODE_W / 2,
          y2: c.y,
        })
        if (c.children.length > 0) collectEdges(c.children)
      })
    })
  }
  collectEdges(rootNodes)

  return { nodes: allNodes, edges, canvasW, canvasH }
}
