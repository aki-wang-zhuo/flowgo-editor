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

/** LogicFlow getGraphData / render 使用的节点结构 */
export interface LfNode {
  id: string
  type: string
  x: number
  y: number
  text?: string | { value: string }
  properties?: Record<string, unknown>
}

/** LogicFlow 边结构 */
export interface LfEdge {
  id: string
  type?: string
  sourceNodeId: string
  targetNodeId: string
  /** 源锚点 id（HTTP 入口按路径槽绑定） */
  sourceAnchorId?: string
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
  const nodes: LfNode[] = (dsl.nodes || []).map((n, i) => {
    const type = n.type || 'jsTransform'
    const meta = cachedComponentMeta(type)
    return {
      id: n.id,
      type,
      x: n.x ?? 160 + (i % 4) * 200,
      y: n.y ?? 120 + Math.floor(i / 4) * 100,
      text: n.name || n.type,
      properties: {
        name: n.name || n.type,
        configuration: n.configuration || {},
        isEntry: n.id === dsl.entryNode,
        debug: !!n.debug,
        color: meta?.color || '#fdd0a2',
        iconText: meta?.iconText || 'ƒ',
      },
    }
  })

  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  const edges: LfEdge[] = (dsl.edges || []).map((e, i) => {
    const relation = e.relation || 'Success'
    const source = nodeById.get(e.from)
    let text = relation
    let sourceAnchorId: string | undefined
    const properties: Record<string, unknown> = { relation }
    const pointsList = normalizePointsList(e.pointsList)

    // HTTP 入口：连线文案用名称或 METHOD path，并挂到唯一右侧锚点
    if (source?.type === 'httpEndpoint') {
      const routers = readRouters(source.properties?.configuration)
      let idx = routers.findIndex((r) => routerRelation(r) === relation)
      if (idx < 0) {
        // 兼容旧数据：relation 仅为 Success 或路径
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

    // IF / SWITCH：用友好文案（case name 或 True/False/Default）
    if (source?.type === 'if' || source?.type === 'switch') {
      const cases =
        source.type === 'switch'
          ? readSwitchCases(source.properties?.configuration)
          : undefined
      text = branchRelationLabel(relation, cases)
      properties.relation = relation
    }

    // 注入执行：单右锚点，默认 Success
    if (source?.type === 'inject') {
      text = relation === 'Success' || relation === 'Failure' ? relation : 'Success'
      properties.relation = text
      sourceAnchorId = `${e.from}_right`
    }

    // JS 转换 / HTTP 客户端：单右锚点；文案为 Success / Failure
    if (source?.type === 'jsTransform' || source?.type === 'httpClient') {
      const rel =
        relation === 'Failure' || relation === 'Success' ? relation : 'Success'
      text = rel
      properties.relation = rel
      sourceAnchorId = `${e.from}_right`
    }

    const edge: LfEdge = {
      id: `edge-${e.from}-${e.to}-${i}`,
      type: 'bezier',
      sourceNodeId: e.from,
      targetNodeId: e.to,
      sourceAnchorId,
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
 * @param meta 流程元信息（id / name / entry 覆盖）
 */
export function graphToDsl(
  graph: LfGraphData,
  meta: { id: string; name: string; description?: string; entryNode?: string },
): FlowDSL {
  const nodes: FlowNode[] = (graph.nodes || []).map((n) => {
    const props = n.properties || {}
    const configuration =
      (props.configuration as Record<string, unknown> | undefined) || {}
    return {
      id: n.id,
      type: n.type,
      name: (props.name as string) || textValue(n.text, n.type),
      debug: !!props.debug,
      x: n.x,
      y: n.y,
      configuration,
    }
  })

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
