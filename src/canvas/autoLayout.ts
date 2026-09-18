/**
 * 画布自动布局（dagre）。
 *
 * FlowGo 未使用 LogicFlow 官方 AutoLayout（标注未完善且依赖 flowPath），
 * 与参考编辑器一致采用 @dagrejs/dagre：只改节点坐标，连线由 LogicFlow 跟随；
 * 经 graphModel.moveNode2Coordinate 写入，可 undo。
 *
 * 作用域：有选中节点 → 仅布局选中；无选中 → 全量。
 * 入口类节点（httpEndpoint / inject）钉在布局起点侧（LR=左侧）。
 *
 * 并发分组：组框作为顶层单元参与布局；组内子节点单独在框内排布，避免跑出组外。
 * 移动分组会经 DynamicGroup.getMoveDistance 带动子节点。
 */
import type { LfInstance } from './lf-types'
import { layoutGroupInterior } from './autoLayoutGroup'
import {
  AUTO_LAYOUT_DEFAULTS,
  GROUP_TYPE,
  bbox,
  nodeGeom,
  runDagre,
  type NodeGeom,
} from './autoLayoutShared'

/** 数据入口节点类型（仅出边） */
const ENTRY_TYPES = new Set(['httpEndpoint', 'inject', 'mqttIn'])

export type AutoLayoutOpts = Partial<typeof AUTO_LAYOUT_DEFAULTS>

export interface AutoLayoutResult {
  ok: boolean
  reason?: string
  scope?: 'selection' | 'all'
  nodeCount?: number
  edgeCount?: number
  entryCount?: number
}

export { AUTO_LAYOUT_DEFAULTS }

type GmNode = {
  id: string
  type?: string
  isGroup?: boolean
  children?: Set<string> | string[]
  getData?: () => Record<string, unknown>
  properties?: Record<string, unknown>
}

/**
 * 建立「子节点 → 所属分组」映射（优先 children，其次 properties.parentId）。
 */
function buildChildToGroup(lf: LfInstance): Map<string, string> {
  const map = new Map<string, string>()
  const nodes = (lf.graphModel?.nodes || []) as GmNode[]
  for (const n of nodes) {
    if (!n?.id) continue
    const children = n.children
      ? Array.from(n.children as Set<string> | string[])
      : []
    for (const cid of children) {
      if (cid) map.set(String(cid), n.id)
    }
  }
  for (const n of nodes) {
    if (!n?.id || map.has(n.id)) continue
    const data = n.getData?.() || n
    const props = (data as { properties?: Record<string, unknown> }).properties || {}
    const pid = String(props.parentId || '').trim()
    if (pid) map.set(n.id, pid)
  }
  return map
}

/**
 * 对当前画布执行自动布局。
 * @returns 结果摘要；ok=false 时带 reason
 */
export function layoutGraph(
  lf: LfInstance | null | undefined,
  opts: AutoLayoutOpts = {},
): AutoLayoutResult {
  const gm = lf?.graphModel
  if (!lf || !gm) return { ok: false, reason: 'no graphModel' }

  const profile = { ...AUTO_LAYOUT_DEFAULTS, ...opts }
  const isLR = profile.rankdir !== 'TB'
  profile.rankdir = isLR ? 'LR' : 'TB'

  const childToGroup = buildChildToGroup(lf)

  const sel = lf.getSelectElements?.() as { nodes?: Array<{ id: string }> } | undefined
  const selNodes = sel?.nodes || []
  const scoped = selNodes.length > 0

  // 选中子节点时抬升为所属分组，避免只排子节点把它们甩出组外
  const seedIds = new Set<string>()
  if (scoped) {
    for (const n of selNodes) {
      const gid = childToGroup.get(n.id)
      seedIds.add(gid || n.id)
    }
  }

  const dataNodes = scoped
    ? [...seedIds].map((id) => {
        const m = lf.getNodeModelById?.(id) as GmNode | undefined
        return m ? ((m.getData?.() || m) as Record<string, unknown>) : { id }
      })
    : ((gm.nodes || []) as GmNode[]).map((n) => n.getData?.() || n)

  const geoms = dataNodes
    .map((n) => nodeGeom(lf, n as Parameters<typeof nodeGeom>[1]))
    .filter((n) => n.id)
    // 顶层布局排除组内子节点（子节点随组移动 / 组内单独排布）
    .filter((n) => !childToGroup.has(n.id))

  if (geoms.length === 0) return { ok: false, reason: 'no nodes' }

  const entryNodes = geoms.filter((n) => ENTRY_TYPES.has(n.type))
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

  /** 边端点提升到顶层：子节点 → 所属分组 */
  const topId = (id: string) => childToGroup.get(id) || id

  const edgeKeys = new Set<string>()
  const edges: Array<{ source: string; target: string }> = []
  for (const e of (gm.edges || []) as Array<{
    sourceNodeId: string
    targetNodeId: string
  }>) {
    const s = topId(e.sourceNodeId)
    const t = topId(e.targetNodeId)
    if (s === t) continue // 组内边不参与顶层
    if (!layoutIds.has(s) || !layoutIds.has(t)) continue
    const key = `${s}->${t}`
    if (edgeKeys.has(key)) continue
    edgeKeys.add(key)
    edges.push({ source: s, target: t })
  }

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

  // 先移组框（会带动子节点），再做组内排布
  layoutNodes.forEach((n) => {
    const p = pos.get(n.id)
    if (!p) return
    gm.moveNode2Coordinate(n.id, p.x + offX, p.y + offY, true)
  })

  // 入口钉在 dagre 结果起点侧
  pinEntryNodes(gm, entryNodes, dVals, sBox, offX, offY, profile.ranksep, isLR)

  // 组内子节点重新排布到框内
  for (const n of layoutNodes) {
    if (n.type === GROUP_TYPE) {
      layoutGroupInterior(lf, n.id, profile)
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

/** 入口节点钉在布局起点侧 */
function pinEntryNodes(
  gm: NonNullable<LfInstance['graphModel']>,
  entryNodes: NodeGeom[],
  dVals: Array<{ x: number; y: number; width: number; height: number }>,
  sBox: { minX: number; minY: number; maxX: number; maxY: number },
  offX: number,
  offY: number,
  gap: number,
  isLR: boolean,
) {
  if (!entryNodes.length || !dVals.length) return
  const movedVals = dVals.map((p) => ({
    x: p.x + offX,
    y: p.y + offY,
    width: p.width,
    height: p.height,
  }))
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
