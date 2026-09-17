/**
 * 画布自动布局（dagre）。
 *
 * FlowGo 未使用 LogicFlow 官方 AutoLayout（标注未完善且依赖 flowPath），
 * 与参考编辑器一致采用 @dagrejs/dagre：只改节点坐标，连线由 LogicFlow 跟随；
 * 经 graphModel.moveNode2Coordinate 写入，可 undo。
 *
 * 作用域：有选中节点 → 仅布局选中；无选中 → 全量。
 * 入口类节点（httpEndpoint / inject）钉在布局起点侧（LR=左侧）。
 */
import dagre from '@dagrejs/dagre'
import type { LfInstance } from './lf-types'

/** 数据入口节点类型（仅出边） */
const ENTRY_TYPES = new Set(['httpEndpoint', 'inject'])

/** 默认布局参数（左→右；间隔需容纳边上路径标签） */
export const AUTO_LAYOUT_DEFAULTS = {
  rankdir: 'LR' as 'LR' | 'TB',
  /** 层间距（LR 下为左右间距），过小会遮挡边标签 */
  ranksep: 180,
  /** 同层节点间距（LR 下为上下间距，Success/Failure 分支） */
  nodesep: 80,
  marginx: 30,
  marginy: 30,
}

export type AutoLayoutOpts = Partial<typeof AUTO_LAYOUT_DEFAULTS>

export interface AutoLayoutResult {
  ok: boolean
  reason?: string
  scope?: 'selection' | 'all'
  nodeCount?: number
  edgeCount?: number
  entryCount?: number
}

interface NodeGeom {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** 从实时 model 读取几何（getData 顶层常缺 width/height） */
function nodeGeom(lf: LfInstance, n: { id: string; type?: string; x?: number; y?: number; width?: number; height?: number; properties?: Record<string, unknown> }): NodeGeom {
  const m = lf.getNodeModelById?.(n.id) as
    | { x?: number; y?: number; width?: number; height?: number; type?: string }
    | undefined
  const w =
    (m && m.width) ||
    n.width ||
    Number((n.properties as { width?: number } | undefined)?.width) ||
    120
  const h =
    (m && m.height) ||
    n.height ||
    Number((n.properties as { height?: number } | undefined)?.height) ||
    40
  return {
    id: n.id,
    type: (m && m.type) || n.type || '',
    x: m && m.x != null ? m.x : Number(n.x) || 0,
    y: m && m.y != null ? m.y : Number(n.y) || 0,
    width: w,
    height: h,
  }
}

function bbox(items: Array<{ x: number; y: number; width: number; height: number }>): BBox {
  return {
    minX: Math.min(...items.map((p) => p.x - p.width / 2)),
    minY: Math.min(...items.map((p) => p.y - p.height / 2)),
    maxX: Math.max(...items.map((p) => p.x + p.width / 2)),
    maxY: Math.max(...items.map((p) => p.y + p.height / 2)),
  }
}

function runDagre(
  nodes: Array<{ id: string; width: number; height: number }>,
  edges: Array<{ source: string; target: string }>,
  opts: { rankdir: string; ranksep: number; nodesep: number; marginx: number; marginy: number },
): Map<string, { x: number; y: number; width: number; height: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph(opts)
  g.setDefaultEdgeLabel(() => ({}))
  nodes.forEach((n) => g.setNode(n.id, { width: n.width, height: n.height }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  const out = new Map<string, { x: number; y: number; width: number; height: number }>()
  nodes.forEach((n) => {
    const r = g.node(n.id) as { x: number; y: number }
    out.set(n.id, { x: r.x, y: r.y, width: n.width, height: n.height })
  })
  return out
}

/**
 * 对当前画布执行自动布局。
 * @returns 结果摘要；ok=false 时带 reason
 */
export function layoutGraph(lf: LfInstance | null | undefined, opts: AutoLayoutOpts = {}): AutoLayoutResult {
  const gm = lf?.graphModel
  if (!lf || !gm) return { ok: false, reason: 'no graphModel' }

  const profile = { ...AUTO_LAYOUT_DEFAULTS, ...opts }
  const isLR = profile.rankdir !== 'TB'
  profile.rankdir = isLR ? 'LR' : 'TB'

  const sel = lf.getSelectElements?.() as { nodes?: Array<{ id: string }> } | undefined
  const selNodes = sel?.nodes || []
  const scoped = selNodes.length > 0
  const dataNodes = scoped
    ? selNodes
    : ((gm.nodes || []) as Array<{ getData?: () => Record<string, unknown> }>).map(
        (n) => n.getData?.() || n,
      )

  const geoms = dataNodes
    .map((n) => nodeGeom(lf, n as Parameters<typeof nodeGeom>[1]))
    .filter((n) => n.id)
  if (geoms.length === 0) return { ok: false, reason: 'no nodes' }

  const entryNodes = geoms.filter((n) => ENTRY_TYPES.has(n.type))
  // 非入口节点参与 dagre；入口钉到起点侧
  const layoutNodes = geoms.filter((n) => !ENTRY_TYPES.has(n.type))
  if (layoutNodes.length === 0) {
    return {
      ok: true,
      scope: scoped ? 'selection' : 'all',
      nodeCount: 0,
      edgeCount: 0,
      entryCount: entryNodes.length,
    }
  }

  const layoutIds = new Set(layoutNodes.map((n) => n.id))
  const edges = ((gm.edges || []) as Array<{ sourceNodeId: string; targetNodeId: string }>)
    .map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId }))
    .filter((e) => layoutIds.has(e.source) && layoutIds.has(e.target))

  const pos = runDagre(layoutNodes, edges, {
    rankdir: profile.rankdir,
    ranksep: profile.ranksep,
    nodesep: profile.nodesep,
    marginx: profile.marginx,
    marginy: profile.marginy,
  })

  const dVals = [...pos.values()]
  const dBox = bbox(dVals)
  const sBox = bbox(geoms)
  const offX = sBox.minX - dBox.minX
  const offY = sBox.minY - dBox.minY

  layoutNodes.forEach((n) => {
    const p = pos.get(n.id)
    if (!p) return
    gm.moveNode2Coordinate(n.id, p.x + offX, p.y + offY, true)
  })

  // 入口钉在 dagre 结果起点侧
  if (entryNodes.length && dVals.length) {
    const movedVals = dVals.map((p) => ({
      x: p.x + offX,
      y: p.y + offY,
      width: p.width,
      height: p.height,
    }))
    const gap = profile.ranksep
    if (isLR) {
      const left = Math.min(...movedVals.map((p) => p.x - p.width / 2))
      const topY = sBox.minY
      const spanY = sBox.maxY - sBox.minY
      const stepY = entryNodes.length > 1 ? spanY / (entryNodes.length - 1) : 0
      entryNodes.forEach((n, i) => {
        const y = entryNodes.length > 1 ? topY + stepY * i : (sBox.minY + sBox.maxY) / 2
        gm.moveNode2Coordinate(n.id, left - gap - n.width / 2, y, true)
      })
    } else {
      const top = Math.min(...movedVals.map((p) => p.y - p.height / 2))
      const leftX = sBox.minX
      const spanX = sBox.maxX - sBox.minX
      const stepX = entryNodes.length > 1 ? spanX / (entryNodes.length - 1) : 0
      entryNodes.forEach((n, i) => {
        const x = entryNodes.length > 1 ? leftX + stepX * i : (sBox.minX + sBox.maxX) / 2
        gm.moveNode2Coordinate(n.id, x, top - gap - n.height / 2, true)
      })
    }
  }

  refreshEdgesAfterLayout(lf)

  return {
    ok: true,
    scope: scoped ? 'selection' : 'all',
    nodeCount: layoutNodes.length,
    edgeCount: edges.length,
    entryCount: entryNodes.length,
  }
}

/**
 * 布局后重算贝塞尔控制点与标签位置。
 * moveNode 只按 delta 平移旧控制点，大范围重排后曲线/标签易偏离；统一 regenerate。
 */
function refreshEdgesAfterLayout(lf: LfInstance) {
  const edges = (lf.graphModel?.edges || []) as Array<{
    updatePoints?: () => void
    text?: { value?: string }
    resetTextPosition?: () => void
  }>
  for (const edge of edges) {
    edge.updatePoints?.()
    if (edge.text?.value) {
      edge.resetTextPosition?.()
    }
  }
}
