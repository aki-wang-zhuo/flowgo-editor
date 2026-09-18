/**
 * 自动布局共享类型与几何工具（顶层 / 组内共用）。
 */
import dagre from '@dagrejs/dagre'
import type { LfInstance } from './lf-types'

/** 组框类型 */
export const GROUP_TYPE = 'concurrentGroup'

/** 组内布局相对框缘的内边距（避开左右锚点区） */
export const GROUP_PAD = { left: 56, right: 72, top: 40, bottom: 40 }

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

export interface NodeGeom {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** 从实时 model 读取几何（getData 顶层常缺 width/height） */
export function nodeGeom(
  lf: LfInstance,
  n: {
    id: string
    type?: string
    x?: number
    y?: number
    width?: number
    height?: number
    properties?: Record<string, unknown>
  },
): NodeGeom {
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

export function bbox(
  items: Array<{ x: number; y: number; width: number; height: number }>,
): BBox {
  return {
    minX: Math.min(...items.map((p) => p.x - p.width / 2)),
    minY: Math.min(...items.map((p) => p.y - p.height / 2)),
    maxX: Math.max(...items.map((p) => p.x + p.width / 2)),
    maxY: Math.max(...items.map((p) => p.y + p.height / 2)),
  }
}

export function runDagre(
  nodes: Array<{ id: string; width: number; height: number }>,
  edges: Array<{ source: string; target: string }>,
  opts: {
    rankdir: string
    ranksep: number
    nodesep: number
    marginx: number
    marginy: number
  },
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
