/**
 * FlowDSL ↔ LogicFlow 图数据互转。
 */
import type { FlowDSL, FlowEdge, FlowNode } from '@/types/flow'
import { cachedComponentMeta } from './componentCatalog'
import {
  readRouters,
  routerLabel,
  routerRelation,
} from './httpRouter'
import {
  branchRelationLabel,
  readSwitchCases,
} from './branchRouter'
import {
  concurrentExitRelations,
  readConcurrentBranches,
} from './useConcurrentGroupEdges'
import {
  CG_ANCHOR,
  CG_DEFAULT_HEIGHT,
  CG_DEFAULT_WIDTH,
} from './nodes/concurrentGroupStyle'

/** LogicFlow getGraphData / render 使用的节点结构 */
export interface LfNode {
  id: string
  type: string
  x: number
  y: number
  text?: string | { value: string }
  properties?: Record<string, unknown>
  /** DynamicGroup 子节点 id 列表 */
  children?: string[]
}

/** LogicFlow 边结构 */
export interface LfEdge {
  id: string
  type?: string
  sourceNodeId: string
  targetNodeId: string
  /** 源锚点 id */
  sourceAnchorId?: string
  /** 目标锚点 id（并发分组汇合 / 左入） */
  targetAnchorId?: string
  text?: string | { value: string }
  properties?: Record<string, unknown>
  /** 贝塞尔折点 / 控制点 */
  pointsList?: Array<{ x: number; y: number }>
}

export interface LfGraphData {
  nodes: LfNode[]
  edges: LfEdge[]
}

function textValue(text: string | { value: string } | undefined, fallback = ''): string {
  if (!text) return fallback
  if (typeof text === 'string') return text
  return text.value || fallback
}

/** 规范化 pointsList，过滤非法点 */
function normalizePointsList(
  list: unknown,
): Array<{ x: number; y: number }> | undefined {
  if (!Array.isArray(list) || list.length < 2) return undefined
  const out: Array<{ x: number; y: number }> = []
  for (const p of list) {
    if (!p || typeof p !== 'object') continue
    const x = Number((p as { x?: unknown }).x)
    const y = Number((p as { y?: unknown }).y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out.push({ x, y })
  }
  return out.length >= 2 ? out : undefined
}

/**
 * DSL → LogicFlow 图数据，供 lf.render 使用。
 */
export function dslToGraph(dsl: FlowDSL): LfGraphData {
  const parentChildren = new Map<string, string[]>()
  for (const n of dsl.nodes || []) {
    const pid = String(n.parentId || '').trim()
    if (!pid) continue
    const list = parentChildren.get(pid) || []
    list.push(n.id)
    parentChildren.set(pid, list)
  }

  const nodes: LfNode[] = (dsl.nodes || []).map((n, i) => {
    const type = n.type || 'jsTransform'
    const meta = cachedComponentMeta(type)
    const conf = { ...(n.configuration || {}) }
    const children = parentChildren.get(n.id) || []
    const props: Record<string, unknown> = {
      name: n.name || n.type,
      configuration: conf,
      isEntry: n.id === dsl.entryNode,
      debug: !!n.debug,
      color: meta?.color || '#fdd0a2',
      iconText: meta?.iconText || 'ƒ',
    }
    if (n.parentId) {
      props.parentId = n.parentId
    }
    if (type === 'concurrentGroup') {
      props.children = children
      props.allowEdgeConnect = true
      props.width = Number(conf.width) || CG_DEFAULT_WIDTH
      props.height = Number(conf.height) || CG_DEFAULT_HEIGHT
    }
    const node: LfNode = {
      id: n.id,
      type,
      x: n.x ?? 160 + (i % 4) * 200,
      y: n.y ?? 120 + Math.floor(i / 4) * 100,
      text: n.name || n.type,
      properties: props,
    }
    if (type === 'concurrentGroup' && children.length) {
      node.children = children
    }
    return node
  })

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const exitRels = new Set(concurrentExitRelations())

  const edges: LfEdge[] = (dsl.edges || []).map((e, i) => {
    const relation = e.relation || 'Success'
    const source = nodeById.get(e.from)
    const target = nodeById.get(e.to)
    let text = relation
    let sourceAnchorId: string | undefined
    let targetAnchorId: string | undefined
    const properties: Record<string, unknown> = { relation }
    const pointsList = normalizePointsList(e.pointsList)

    if (source?.type === 'httpEndpoint') {
      const routers = readRouters(source.properties?.configuration)
      let idx = routers.findIndex((r) => routerRelation(r) === relation)
      if (idx < 0) {
        idx = routers.findIndex(
          (r) => r.path === relation || routerLabel(r) === relation,
        )
      }
      if (idx < 0 && routers.length === 1) idx = 0
      if (idx >= 0) {
        const r = routers[idx]
        text = routerLabel(r)
        sourceAnchorId = `${e.from}_right`
        properties.relation = routerRelation(r)
        properties.routerIndex = idx
      }
    }

    if (source?.type === 'if' || source?.type === 'switch') {
      const cases =
        source.type === 'switch'
          ? readSwitchCases(source.properties?.configuration)
          : undefined
      text = branchRelationLabel(relation, cases)
      properties.relation = relation
    }

    // 并发分组：扇出 / 出组
    if (source?.type === 'concurrentGroup') {
      const branches = new Set(
        readConcurrentBranches(source.properties?.configuration),
      )
      if (exitRels.has(relation) && !branches.has(relation)) {
        text = relation
        properties.relation = relation
        sourceAnchorId = `${e.from}_${CG_ANCHOR.right}`
      } else {
        text = relation
        properties.relation = relation
        sourceAnchorId = `${e.from}_${CG_ANCHOR.fork}`
      }
    }

    // 连到并发分组：组内汇合 or 外部进入
    if (target?.type === 'concurrentGroup') {
      const fromParent = String(source?.properties?.parentId || '')
      if (fromParent === e.to) {
        const fail = relation === 'Failure'
        targetAnchorId = `${e.to}_${fail ? CG_ANCHOR.joinFail : CG_ANCHOR.joinOk}`
        properties.relation = fail ? 'Failure' : 'Success'
        text = properties.relation as string
      } else {
        targetAnchorId = `${e.to}_${CG_ANCHOR.left}`
        text = ''
        properties.relation = 'Success'
      }
    }

    if (source?.type === 'inject') {
      text = relation === 'Success' || relation === 'Failure' ? relation : 'Success'
      properties.relation = text
      sourceAnchorId = `${e.from}_right`
    }

    if (source?.type === 'jsTransform' || source?.type === 'httpClient') {
      const rel =
        relation === 'Failure' || relation === 'Success' ? relation : 'Success'
      text = rel
      properties.relation = rel
      sourceAnchorId = `${e.from}_right`
    }

    if (source?.type === 'currentTime') {
      text = ''
      properties.relation = 'Success'
      sourceAnchorId = `${e.from}_right`
    }

    const edge: LfEdge = {
      id: `edge-${e.from}-${e.to}-${i}`,
      type: 'bezier',
      sourceNodeId: e.from,
      targetNodeId: e.to,
      sourceAnchorId,
      targetAnchorId,
      text,
      properties,
    }
    if (pointsList) edge.pointsList = pointsList
    return edge
  })

  return { nodes, edges }
}

/**
 * LogicFlow 图数据 → FlowDSL。
 */
export function graphToDsl(
  graph: LfGraphData,
  meta: { id: string; name: string; description?: string; entryNode?: string },
): FlowDSL {
  const nodes: FlowNode[] = (graph.nodes || []).map((n) => {
    const props = n.properties || {}
    const configuration = {
      ...((props.configuration as Record<string, unknown> | undefined) || {}),
    }
    if (n.type === 'concurrentGroup') {
      const w = Number(props.width) || Number(configuration.width) || CG_DEFAULT_WIDTH
      const h =
        Number(props.height) || Number(configuration.height) || CG_DEFAULT_HEIGHT
      configuration.width = w
      configuration.height = h
    }
    const parentId = String(props.parentId || '').trim()
    const node: FlowNode = {
      id: n.id,
      type: n.type,
      name: (props.name as string) || textValue(n.text, n.type),
      debug: !!props.debug,
      x: n.x,
      y: n.y,
      configuration,
    }
    if (parentId) node.parentId = parentId
    return node
  })

  for (const n of graph.nodes || []) {
    if (n.type !== 'concurrentGroup') continue
    const childIds = new Set<string>()
    const fromProps = n.properties?.children
    if (Array.isArray(fromProps)) {
      for (const id of fromProps) childIds.add(String(id))
    }
    if (Array.isArray(n.children)) {
      for (const id of n.children) childIds.add(String(id))
    }
    for (const childId of childIds) {
      const child = nodes.find((x) => x.id === childId)
      if (child) child.parentId = n.id
    }
  }

  const edges: FlowEdge[] = (graph.edges || []).map((e) => {
    const edge: FlowEdge = {
      from: e.sourceNodeId,
      to: e.targetNodeId,
      relation:
        (e.properties?.relation as string) ||
        textValue(e.text, 'Success') ||
        'Success',
    }
    const pointsList = normalizePointsList(e.pointsList)
    if (pointsList) edge.pointsList = pointsList
    return edge
  })

  let entryNode = meta.entryNode || ''
  if (!entryNode) {
    const marked = (graph.nodes || []).find((n) => n.properties?.isEntry)
    entryNode = marked?.id || nodes[0]?.id || ''
  }

  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    entryNode,
    nodes,
    edges,
  }
}

/** 生成简短流程 / 节点 ID */
export function newFlowId(): string {
  return `flow-${Date.now().toString(36)}`
}

export function newNodeId(type: string): string {
  return `${type}-${Math.random().toString(36).slice(2, 8)}`
}
