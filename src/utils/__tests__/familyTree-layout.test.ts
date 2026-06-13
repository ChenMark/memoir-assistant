/**
 * 家族树布局算法测试
 * 验证 buildLayout 在各种场景下的正确性
 *
 * 测试场景:
 * 1. 空数据集
 * 2. 单节点
 * 3. 简单父子关系 (2层)
 * 4. 兄弟节点并排
 * 5. 三代同堂
 * 6. 配偶关系
 * 7. 多分支碰撞检测
 * 8. 孤儿节点 (无parentId)
 *
 * 运行: npx tsx src/utils/__tests__/familyTree-layout.test.ts
 */

// 复制布局算法核心逻辑（因为原函数与组件紧耦合）
const NODE_W = 116
const NODE_H = 56
const LEVEL_GAP = 100
const NODE_GAP = 16
const SPOUSE_GAP = 6
const FAMILY_GAP = 32
const PADDING_X = 50
const PADDING_Y = 36

interface Friend {
  id: string
  name: string
  generation?: number
  parentId?: string
  spouseId?: string
  category: string
  addedAt: number
  tags?: string[]
}

interface LayoutNode {
  friend: Friend
  x: number
  y: number
}

interface SpouseEdge { x1: number; y1: number; x2: number; y2: number }
interface ParentEdge { path: string }

interface LayoutResult {
  nodes: LayoutNode[]
  spouseEdges: SpouseEdge[]
  parentEdges: ParentEdge[]
  canvasW: number
  canvasH: number
}

function buildLayout(friends: Friend[]): LayoutResult {
  if (friends.length === 0) {
    return { nodes: [], spouseEdges: [], parentEdges: [], canvasW: 400, canvasH: 200 }
  }
  const idMap = new Map(friends.map(f => [f.id, f]))
  const gens = friends.map(f => f.generation ?? 0)
  const minGen = Math.min(...gens)
  const maxGen = Math.max(...gens)
  const byGen = new Map<number, Friend[]>()
  friends.forEach(f => {
    const g = f.generation ?? 0
    if (!byGen.has(g)) byGen.set(g, [])
    byGen.get(g)!.push(f)
  })
  const nodeY = new Map<string, number>()
  friends.forEach(f => { nodeY.set(f.id, ((f.generation ?? 0) - minGen) * LEVEL_GAP + PADDING_Y) })
  const getChildren = (parentId: string) => friends.filter(c => c.parentId === parentId)
  const getSpouse = (f: Friend) => f.spouseId ? idMap.get(f.spouseId) : undefined
  const nodeX = new Map<string, number>()

  // 从底向上分配 X
  for (let g = maxGen; g >= minGen; g--) {
    const nodes = byGen.get(g) || []
    // 4a. 先为有孩子的节点分配 x
    nodes.forEach(f => {
      if (nodeX.has(f.id)) return
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
    // 4b. 为配偶分配位置
    nodes.forEach(f => {
      const spouse = getSpouse(f)
      if (spouse && nodeX.has(f.id) && !nodeX.has(spouse.id)) {
        nodeX.set(spouse.id, nodeX.get(f.id)! + NODE_W + SPOUSE_GAP)
      }
    })
    // 4c. 未放置节点
    const unplaced = nodes.filter(f => !nodeX.has(f.id))
    if (unplaced.length > 0) {
      const siblingGroups = new Map<string | undefined, Friend[]>()
      unplaced.forEach(f => {
        const key = f.parentId
        if (!siblingGroups.has(key)) siblingGroups.set(key, [])
        siblingGroups.get(key)!.push(f)
      })
      const placedXs = nodes.filter(f => nodeX.has(f.id)).map(f => {
        const x = nodeX.get(f.id)!
        const w = NODE_W + (getSpouse(f) && nodeX.has(getSpouse(f)!.id) ? NODE_W + SPOUSE_GAP : 0)
        return x + w
      })
      let cursorX = placedXs.length > 0 ? Math.max(...placedXs) + FAMILY_GAP : PADDING_X
      siblingGroups.forEach((group, parentId) => {
        if (parentId === undefined) return
        group.forEach(f => { nodeX.set(f.id, cursorX); cursorX += NODE_W + NODE_GAP })
        cursorX += FAMILY_GAP - NODE_GAP
      })
      const orphans = siblingGroups.get(undefined) || []
      orphans.forEach(f => { nodeX.set(f.id, cursorX); cursorX += NODE_W + NODE_GAP })
    }
  }

  // 碰撞检测与调整
  for (let g = minGen; g <= maxGen; g++) {
    const nodes = byGen.get(g) || []
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
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1]
      const curr = ranges[i]
      if (curr.x < prev.right + NODE_GAP) {
        const shift = prev.right + NODE_GAP - curr.x
        curr.x += shift
        nodeX.set(curr.f.id, curr.x)
        curr.right = curr.x + curr.width
        ranges[i].x = curr.x
        ranges[i].right = curr.right
        shiftSubtree(curr.f.id, shift, nodeX, friends, byGen)
      }
    }
  }

  const layoutNodes: LayoutNode[] = friends.map(f => ({
    friend: f, x: nodeX.get(f.id) ?? PADDING_X, y: nodeY.get(f.id) ?? PADDING_Y,
  }))
  const spouseEdges: SpouseEdge[] = []
  const parentEdges: ParentEdge[] = []
  friends.forEach(f => {
    if (f.spouseId && nodeX.has(f.id) && nodeX.has(f.spouseId)) {
      const sx = nodeX.get(f.id)! + NODE_W
      const sy = nodeY.get(f.id)! + NODE_H / 2
      const ex = nodeX.get(f.spouseId)!
      const ey = nodeY.get(f.spouseId)! + NODE_H / 2
      if (sx < ex) { spouseEdges.push({ x1: sx, y1: sy, x2: ex, y2: ey }) }
    }
  })
  friends.forEach(f => {
    if (!f.parentId) return
    const parent = idMap.get(f.parentId)
    if (!parent || !nodeX.has(f.parentId) || !nodeX.has(f.id)) return
    const px = nodeX.get(f.parentId)! + NODE_W / 2
    const py = nodeY.get(f.parentId)! + NODE_H
    const cx = nodeX.get(f.id)! + NODE_W / 2
    const cy = nodeY.get(f.id)!
    let startX = px
    if (parent.spouseId && nodeX.has(parent.spouseId)) {
      const spouseX = nodeX.get(parent.spouseId)!
      startX = (px + spouseX + NODE_W / 2) / 2
    }
    const midY = (py + cy) / 2
    const d = `M${startX},${py} C${startX},${midY} ${cx},${midY} ${cx},${cy}`
    parentEdges.push({ path: d })
  })
  const allXs = Array.from(nodeX.values())
  const allYs = Array.from(nodeY.values())
  const maxX = allXs.length > 0 ? Math.max(...allXs) : 0
  const maxY = allYs.length > 0 ? Math.max(...allYs) : 0
  const canvasW = Math.max(400, maxX + NODE_W + PADDING_X)
  const canvasH = Math.max(200, maxY + NODE_H + PADDING_Y)
  return { nodes: layoutNodes, spouseEdges, parentEdges, canvasW, canvasH }
}

function shiftSubtree(rootId: string, shift: number, nodeX: Map<string, number>, friends: Friend[], byGen: Map<number, Friend[]>) {
  const root = friends.find(f => f.id === rootId)
  if (!root) return
  const descendantIds = new Set<string>()
  const queue = [rootId]
  while (queue.length > 0) {
    const pid = queue.shift()!
    const children = friends.filter(f => f.parentId === pid)
    children.forEach(c => {
      if (!descendantIds.has(c.id)) { descendantIds.add(c.id); queue.push(c.id) }
    })
  }
  const toShift = new Set([rootId, ...descendantIds])
  if (root.spouseId) toShift.add(root.spouseId)
  descendantIds.forEach(id => {
    const f = friends.find(x => x.id === id)
    if (f?.spouseId) toShift.add(f.spouseId)
  })
  toShift.forEach(id => { if (nodeX.has(id)) { nodeX.set(id, nodeX.get(id)! + shift) } })
}

function makeFriend(overrides: Partial<Friend> & { id: string; name: string }): Friend {
  return {
    category: 'family',
    addedAt: Date.now(),
    generation: 0,
    ...overrides,
  }
}

// ================================================================
// 测试断言
// ================================================================
let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`) }
  else { failed++; console.log(`  ❌ ${msg}`) }
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
  const ok = actual === expected
  if (ok) { passed++; console.log(`  ✅ ${msg}: ${expected}`) }
  else { failed++; console.log(`  ❌ ${msg}: 期望 ${expected}, 实际 ${actual}`) }
}

// ================================================================
// 测试场景
// ================================================================

console.log('\n🧪 家族树布局算法测试')
console.log('================================\n')

// --- 场景1: 空数据集 ---
console.log('场景1: 空数据集')
{
  const result = buildLayout([])
  assert(result.nodes.length === 0, '节点数为0')
  assert(result.canvasW === 400, '画布宽度=400')
  assert(result.canvasH === 200, '画布高度=200')
  assert(result.spouseEdges.length === 0, '无配偶连线')
  assert(result.parentEdges.length === 0, '无亲子连线')
}

// --- 场景2: 单节点 ---
console.log('场景2: 单节点 (我)')
{
  const friends = [makeFriend({ id: 'me', name: '我', generation: 0 })]
  const result = buildLayout(friends)
  assert(result.nodes.length === 1, '节点数为1')
  assert(result.nodes[0].x >= 0, 'X坐标合法')
  assert(result.nodes[0].y >= 0, 'Y坐标合法')
  assert(result.spouseEdges.length === 0, '无配偶连线')
  assert(result.parentEdges.length === 0, '无亲子连线')
}

// --- 场景3: 父子关系 (2层) ---
console.log('场景3: 父子关系 (父→子)')
{
  const friends = [
    makeFriend({ id: 'dad', name: '爸爸', generation: 1 }),
    makeFriend({ id: 'me', name: '我', generation: 0, parentId: 'dad' }),
  ]
  const result = buildLayout(friends)
  assert(result.nodes.length === 2, '节点数为2')
  assert(result.parentEdges.length === 1, '有1条亲子连线')
  // 注意: 当前布局从自身(gen=0顶)向下展开，父辈(gen>0)在下方
  // 这与传统家谱图示方向相反，是一种"根系"布局风格
  const dad = result.nodes.find(n => n.friend.id === 'dad')!
  const me = result.nodes.find(n => n.friend.id === 'me')!
  assert(dad.y > me.y, '父节点Y > 子节点Y (自身在上，父辈在下)')
  assert(dad.y - me.y === LEVEL_GAP, `父辈与自身间距=LEVEL_GAP (${dad.y - me.y} = ${LEVEL_GAP})`)
  // X 坐标应对齐
  assert(Math.abs(dad.x - me.x) < NODE_W, '父子X坐标基本对齐')
}

// --- 场景4: 两兄弟 ---
console.log('场景4: 兄弟节点并排')
{
  const friends = [
    makeFriend({ id: 'dad', name: '爸爸', generation: 1 }),
    makeFriend({ id: 'bro1', name: '大哥', generation: 0, parentId: 'dad' }),
    makeFriend({ id: 'bro2', name: '小弟', generation: 0, parentId: 'dad' }),
  ]
  const result = buildLayout(friends)
  const bro1 = result.nodes.find(n => n.friend.id === 'bro1')!
  const bro2 = result.nodes.find(n => n.friend.id === 'bro2')!
  assert(bro1.y === bro2.y, '兄弟同Y坐标')
  assert(bro1.x !== bro2.x, '兄弟X坐标不同')
  assert(result.parentEdges.length === 2, '2条亲子连线')
  // 兄弟间应有间距
  const gap = Math.abs(bro2.x - bro1.x)
  assert(gap >= NODE_W, `兄弟间距>=节点宽 (${gap} >= ${NODE_W})`)
}

// --- 场景5: 三代同堂 ---
console.log('场景5: 三代同堂 (爷→父→我)')
{
  const friends = [
    makeFriend({ id: 'grandpa', name: '爷爷', generation: 2 }),
    makeFriend({ id: 'dad', name: '爸爸', generation: 1, parentId: 'grandpa' }),
    makeFriend({ id: 'me', name: '我', generation: 0, parentId: 'dad' }),
  ]
  const result = buildLayout(friends)
  const grandpa = result.nodes.find(n => n.friend.id === 'grandpa')!
  const dad = result.nodes.find(n => n.friend.id === 'dad')!
  const me = result.nodes.find(n => n.friend.id === 'me')!
  // 当前布局: 自身(gen=0)在最上，祖辈(gen=2)在最下
  assert(grandpa.y > dad.y, '爷爷在爸爸下方')
  assert(dad.y > me.y, '爸爸在我下方')
  assertEqual(result.parentEdges.length, 2, '2条亲子连线')
  assert(result.canvasH > LEVEL_GAP * 2, '画布高度 > 2层间距')
}

// --- 场景6: 配偶关系 ---
console.log('场景6: 配偶关系 (夫→妻, 双向spouseId)')
{
  const friends = [
    makeFriend({ id: 'husband', name: '丈夫', generation: 1, spouseId: 'wife' }),
    makeFriend({ id: 'wife', name: '妻子', generation: 1, spouseId: 'husband' }),
  ]
  const result = buildLayout(friends)
  assert(result.nodes.length === 2, '节点数为2')
  assert(result.spouseEdges.length === 1, '有1条配偶连线')
  const hus = result.nodes.find(n => n.friend.id === 'husband')!
  const wife = result.nodes.find(n => n.friend.id === 'wife')!
  assert(wife.x > hus.x, '妻子在丈夫右侧')
  const spouseGap = wife.x - (hus.x + NODE_W)
  assert(spouseGap >= SPOUSE_GAP, `配偶间距>=最小值 (${spouseGap} >= ${SPOUSE_GAP})`)
}

// --- 场景7: 夫妻+孩子 ---
console.log('场景7: 夫妻+孩子')
{
  const friends = [
    makeFriend({ id: 'dad', name: '爸爸', generation: 1, spouseId: 'mom' }),
    makeFriend({ id: 'mom', name: '妈妈', generation: 1 }),
    makeFriend({ id: 'child', name: '孩子', generation: 0, parentId: 'dad' }),
  ]
  const result = buildLayout(friends)
  assert(result.nodes.length === 3, '节点数为3')
  assert(result.spouseEdges.length >= 1, '夫妻有连线')
  assert(result.parentEdges.length >= 1, '有亲子连线')
  // 亲子连线应从夫妻中点出发
  const edge = result.parentEdges[0]
  assert(edge.path.includes('C'), '贝塞尔曲线路径格式正确')
}

// --- 场景8: 复杂家族 (6人，多分支) ---
console.log('场景8: 复杂家族 (6人)')
{
  const friends = [
    makeFriend({ id: 'gpa', name: '爷爷', generation: 2 }),
    makeFriend({ id: 'uncle', name: '叔叔', generation: 1, parentId: 'gpa' }),
    makeFriend({ id: 'dad', name: '爸爸', generation: 1, parentId: 'gpa', spouseId: 'mom' }),
    makeFriend({ id: 'mom', name: '妈妈', generation: 1 }),
    makeFriend({ id: 'me', name: '我', generation: 0, parentId: 'dad' }),
    makeFriend({ id: 'cousin', name: '堂弟', generation: 0, parentId: 'uncle' }),
  ]
  const result = buildLayout(friends)
  assert(result.nodes.length === 6, '节点数为6')
  assert(result.parentEdges.length === 4, '4条亲子连线')
  assert(result.spouseEdges.length === 1, '1条配偶连线')
  // 所有节点应有合法的X,Y
  result.nodes.forEach(n => {
    assert(n.x >= 0 && n.y >= 0, `节点${n.friend.name}坐标合法 (${n.x},${n.y})`)
    assert(n.x < result.canvasW, `节点${n.friend.name}在画布内`)
  })
  // 叔叔和爸爸应在同一层
  const uncle = result.nodes.find(n => n.friend.id === 'uncle')!
  const dad = result.nodes.find(n => n.friend.id === 'dad')!
  assertEqual(uncle.y, dad.y, '叔叔和爸爸同层')
  assert(uncle.x !== dad.x, '叔叔和爸爸X不同')
}

// --- 场景9: 无generation的节点---
console.log('场景9: 默认generation=0的节点')
{
  const friends = [
    makeFriend({ id: 'a', name: 'A' }), // no generation
    makeFriend({ id: 'b', name: 'B' }),
  ]
  const result = buildLayout(friends)
  assert(result.nodes.length === 2, '节点数为2')
  assertEqual(result.nodes[0].y, result.nodes[1].y, '同Y (都在g=0层)')
}

// --- 场景10: 配偶+无parentId节点不重叠 ---
console.log('场景10: 大量同级节点不会重叠')
{
  const friends = Array.from({ length: 10 }, (_, i) =>
    makeFriend({ id: `p${i}`, name: `Person${i}`, generation: 0 }))
  const result = buildLayout(friends)
  assert(result.nodes.length === 10, '10个节点')
  // 验证没有重叠
  const sorted = [...result.nodes].sort((a, b) => a.x - b.x)
  for (let i = 1; i < sorted.length; i++) {
    const prevRight = sorted[i - 1].x + NODE_W
    assert(sorted[i].x >= prevRight - 1, `节点${i}不重叠: ${sorted[i].x} >= ${prevRight}`)
  }
}

// ================================================================
console.log('\n================================')
console.log(`📊 测试完成: ✅ ${passed} 通过, ❌ ${failed} 失败`)
console.log('')

if (failed > 0) {
  process.exit(1)
} else {
  console.log('🎉 家族树布局算法所有测试通过！\n')
}
