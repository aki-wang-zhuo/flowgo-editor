/**
 * 将 MCP 增量补丁应用到 LogicFlow 画布（仅处理变更项）。
 */
import type { FlowDSL, FlowEdge, FlowNode } from '@/types/flow'
import type { LfInstance } from '@/canvas/lf-types'
import { graphToDsl, type LfGraphData } from '@/canvas/adapter'
import { cachedComponentMeta } from '@/canvas/componentCatalog'
import { syncHttpEndpointNode } from '@/canvas/useHttpEndpointEdges'
import { syncSwitchNode } from '@/canvas/useBranchEdges'
import { buildDefaultsFromFields } from '@/components/editor/dynamic/configDefaults'

/** 节点补丁项 */
export interface PatchNodeItem {
  id: string
  /** 默认 update */
  op?: 'update' | 'add' | 'remove'
  type?: string
  name?: string
  debug?: boolean
  x?: number
  y?: number
  configuration?: Record<string, unknown>
  /** true 时 configuration 整体替换；默认与现有浅合并 */
  replaceConfiguration?: boolean
}

/** 边补丁项 */
export interface PatchEdgeItem {
  op: 'add' | 'remove' | 'update'
  from: string
  to: string
  relation?: string
  /** update 时的新 relation */
  newRelation?: string
  pointsList?: Array<{ x: number; y: number }>
}

/** 增量补丁体（勿传整份 DSL） */
export interface ActiveFlowPatch {
  name?: string
  entryNode?: string
  nodes?: PatchNodeItem[]
  edges?: PatchEdgeItem[]
}

export interface PatchItemError {
  path: string
  message: string
}

export interface ApplyPatchResult {
  ok: boolean
  message?: string
  errors: PatchItemError[]
  applied: {
    name?: string
    entryNode?: string
    nodes: FlowNode[]
    edges: FlowEdge[]
  }
  dsl?: FlowDSL
}

function mergeConfig(
  base: Record<string, unknown>,
  patch: Record<string, unknown> | undefined,
  replace: boolean | undefined,
): Record<string, unknown> {
  if (!patch) return { ...base }
  if (replace) return { ...patch }
  return { ...base, ...patch }
}

function findEdgeIds(
  lf: LfInstance,
  from: string,
  to: string,
  relation?: string,
): string[] {
  const data = (lf.getGraphData?.() || { edges: [] }) as LfGraphData
  const out: string[] = []
  for (const e of data.edges || []) {
    if (e.sourceNodeId !== from || e.targetNodeId !== to) continue
    const rel = String((e.properties as { relation?: string } | undefined)?.relation || '')
    if (relation != null && relation !== '' && rel !== relation) continue
    if (e.id) out.push(e.id)
  }
  return out
}

function readNodeSnapshot(lf: LfInstance, id: string): FlowNode | null {
  const model = lf.getNodeModelById?.(id)
  if (!model) return null
  const conf = (model.properties?.configuration as Record<string, unknown>) || {}
  return {
    id,
    type: model.type,
    name: (model.properties?.name as string) || model.text?.value || model.type,
    debug: !!model.properties?.debug,
    x: model.x,
    y: model.y,
    configuration: { ...conf },
  }
}

/**
 * 对激活画布应用增量补丁。
 */
export function applyActiveFlowPatch(opts: {
  lf: LfInstance
  tab: { id: string; name: string; entryNode: string; locked?: boolean }
  patch: ActiveFlowPatch
  getGraphData: () => LfGraphData
  includeDsl?: boolean
}): ApplyPatchResult {
  const { lf, tab, patch, getGraphData, includeDsl } = opts
  const errors: PatchItemError[] = []
  const appliedNodes: FlowNode[] = []
  const appliedEdges: FlowEdge[] = []
  let appliedName: string | undefined
  let appliedEntry: string | undefined

  if (tab.locked) {
    return {
      ok: false,
      message: 'flow is locked',
      errors: [{ path: '', message: 'flow is locked' }],
      applied: { nodes: [], edges: [] },
    }
  }

  // 先删边，再删节点，再改/加节点，再加/改边
  const nodes = patch.nodes || []
  const edges = patch.edges || []

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    const path = `edges[${i}]`
    if (!e || e.op !== 'remove') continue
    if (!e.from || !e.to) {
      errors.push({ path, message: 'from/to required' })
      continue
    }
    const ids = findEdgeIds(lf, e.from, e.to, e.relation)
    if (!ids.length) {
      errors.push({ path, message: 'edge not found' })
      continue
    }
    for (const id of ids) lf.deleteEdge?.(id)
    appliedEdges.push({
      from: e.from,
      to: e.to,
      relation: e.relation,
    })
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const path = `nodes[${i}]`
    if (!n?.id) {
      errors.push({ path, message: 'id required' })
      continue
    }
    const op = n.op || 'update'
    if (op === 'remove') {
      if (!lf.getNodeModelById?.(n.id)) {
        errors.push({ path, message: 'node not found' })
        continue
      }
      lf.deleteNode?.(n.id)
      appliedNodes.push({ id: n.id, type: n.type || '', configuration: {} })
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const path = `nodes[${i}]`
    if (!n?.id) continue
    const op = n.op || 'update'
    if (op === 'remove') continue

    if (op === 'add') {
      if (!n.type) {
        errors.push({ path, message: 'type required for add' })
        continue
      }
      if (lf.getNodeModelById?.(n.id)) {
        errors.push({ path, message: 'node id already exists' })
        continue
      }
      const meta = cachedComponentMeta(n.type)
      const conf =
        n.configuration ||
        buildDefaultsFromFields(meta?.configFields, meta?.defaultScript)
      const name = n.name || meta?.label || n.type
      lf.addNode?.({
        id: n.id,
        type: n.type,
        x: n.x ?? 200,
        y: n.y ?? 200,
        text: name,
        properties: {
          name,
          configuration: conf,
          isEntry: false,
          debug: !!n.debug,
          color: meta?.color || '#fdd0a2',
          iconText: meta?.iconText || 'ƒ',
        },
      })
      const snap = readNodeSnapshot(lf, n.id)
      if (snap) appliedNodes.push(snap)
      continue
    }

    // update
    const model = lf.getNodeModelById?.(n.id)
    if (!model) {
      errors.push({ path, message: 'node not found' })
      continue
    }
    const prevConf =
      (model.properties?.configuration as Record<string, unknown>) || {}
    const nextConf = mergeConfig(prevConf, n.configuration, n.replaceConfiguration)
    const name =
      n.name != null ? String(n.name) : (model.properties?.name as string) || model.text?.value || model.type
    const debug = n.debug != null ? !!n.debug : !!model.properties?.debug
    lf.setProperties?.(n.id, {
      ...model.properties,
      name,
      debug,
      configuration: nextConf,
    })
    if (n.name != null) lf.updateText?.(n.id, name)
    // 必须走 graphModel 移动 API：直接改 model.x/y 只会动外壳，文案锚点不跟随
    if (n.x != null || n.y != null) {
      const x = n.x != null ? Number(n.x) : Number(model.x)
      const y = n.y != null ? Number(n.y) : Number(model.y)
      const gm = lf.graphModel
      if (typeof gm?.moveNode2Coordinate === 'function') {
        gm.moveNode2Coordinate(n.id, x, y, true)
      } else {
        const dx = x - Number(model.x)
        const dy = y - Number(model.y)
        model.x = x
        model.y = y
        if (typeof model.moveText === 'function') {
          model.moveText(dx, dy)
        }
      }
      // Node-RED 样式节点：按外壳重算 text.x/y（修复历史错误坐标或 delta=0 的情况）
      if (typeof model.setAttributes === 'function') {
        model.setAttributes()
      }
    }
    if (model.type === 'httpEndpoint') {
      syncHttpEndpointNode(lf, n.id)
    }
    if (model.type === 'switch') {
      syncSwitchNode(lf, n.id)
    }
    const snap = readNodeSnapshot(lf, n.id)
    if (snap) appliedNodes.push(snap)
  }

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    const path = `edges[${i}]`
    if (!e || e.op === 'remove') continue
    if (!e.from || !e.to) {
      errors.push({ path, message: 'from/to required' })
      continue
    }
    if (e.op === 'add') {
      const relation = e.relation || 'Success'
      if (!lf.getNodeModelById?.(e.from) || !lf.getNodeModelById?.(e.to)) {
        errors.push({ path, message: 'endpoint node missing' })
        continue
      }
      lf.addEdge?.({
        type: 'bezier',
        sourceNodeId: e.from,
        targetNodeId: e.to,
        text: relation,
        properties: { relation },
        pointsList: e.pointsList,
      })
      appliedEdges.push({ from: e.from, to: e.to, relation, pointsList: e.pointsList })
      continue
    }
    if (e.op === 'update') {
      const ids = findEdgeIds(lf, e.from, e.to, e.relation)
      if (!ids.length) {
        errors.push({ path, message: 'edge not found' })
        continue
      }
      const newRel = e.newRelation || e.relation || 'Success'
      for (const id of ids) {
        const em = lf.getEdgeModelById?.(id)
        lf.setProperties?.(id, {
          ...(em?.properties || {}),
          relation: newRel,
        })
        lf.updateText?.(id, newRel)
      }
      appliedEdges.push({ from: e.from, to: e.to, relation: newRel })
    }
  }

  if (patch.name != null && String(patch.name).trim()) {
    appliedName = String(patch.name).trim()
  }
  if (patch.entryNode != null) {
    appliedEntry = String(patch.entryNode)
    // 同步 isEntry 标记
    const data = getGraphData()
    for (const n of data.nodes || []) {
      const m = lf.getNodeModelById?.(n.id)
      if (!m) continue
      lf.setProperties?.(n.id, {
        ...m.properties,
        isEntry: n.id === appliedEntry,
      })
    }
  }

  const ok = errors.length === 0
  const result: ApplyPatchResult = {
    ok,
    message: ok ? undefined : 'partial failure',
    errors,
    applied: {
      name: appliedName,
      entryNode: appliedEntry,
      nodes: appliedNodes,
      edges: appliedEdges,
    },
  }
  if (includeDsl !== false) {
    const graph = getGraphData()
    result.dsl = graphToDsl(graph, {
      id: tab.id,
      name: appliedName || tab.name,
      entryNode: appliedEntry || tab.entryNode,
    })
  }
  return result
}
