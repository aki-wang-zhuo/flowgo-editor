/**
 * 初始化全部内置 runner，并提供从画布触发运行的辅助方法。
 */
import { graphToDsl, type LfGraphData } from '@/canvas/adapter'
import type { LfInstance } from '@/canvas/lf-types'
import { dispatchRun } from './registry'
import { registerHttpEndpointEdgeRunner } from './runners/httpEndpointEdge'
import { registerInjectNodeRunner } from './runners/injectNode'
import { registerHttpClientNodeRunner } from './runners/httpClientNode'
import { registerJsTransformNodeRunner } from './runners/jsTransformNode'
import { registerMqttProbeRunner } from './runners/mqttProbe'
import type { EdgeRunContext, NodeRunContext } from './types'

let inited = false

/** 确保内置 runner 已注册 */
export function ensureRunnersRegistered() {
  if (inited) return
  inited = true
  registerHttpEndpointEdgeRunner()
  registerInjectNodeRunner()
  registerHttpClientNodeRunner()
  registerJsTransformNodeRunner()
  registerMqttProbeRunner()
}

function snapshotDsl(
  lf: LfInstance,
  meta: { id: string; name: string; entryNode?: string },
) {
  const graph = lf.getGraphData() as LfGraphData
  return graphToDsl(graph, meta)
}

/** 运行一条连线（按源节点类型分发） */
export async function runEdge(opts: {
  lf: LfInstance
  flowId: string
  flowName: string
  entryNode?: string
  edgeId: string
}) {
  ensureRunnersRegistered()
  const edge = opts.lf.getEdgeModelById?.(opts.edgeId) as
    | {
        sourceNodeId: string
        targetNodeId: string
        properties?: Record<string, unknown>
      }
    | undefined
  if (!edge) return
  const dsl = snapshotDsl(opts.lf, {
    id: opts.flowId,
    name: opts.flowName,
    entryNode: opts.entryNode,
  })
  const ctx: EdgeRunContext = {
    kind: 'edge',
    flowId: opts.flowId,
    dsl,
    lf: opts.lf,
    edgeId: opts.edgeId,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    relation: String(edge.properties?.relation || ''),
    routerIndex:
      typeof edge.properties?.routerIndex === 'number'
        ? edge.properties.routerIndex
        : undefined,
  }
  await dispatchRun(ctx)
}

/** 运行一个节点（占位：暂无通用实现时由 registry 提示） */
export async function runNode(opts: {
  lf: LfInstance
  flowId: string
  flowName: string
  entryNode?: string
  nodeId: string
  mode: 'run' | 'runOnly' | 'test'
}) {
  ensureRunnersRegistered()
  const dsl = snapshotDsl(opts.lf, {
    id: opts.flowId,
    name: opts.flowName,
    entryNode: opts.entryNode,
  })
  const ctx: NodeRunContext = {
    kind: 'node',
    flowId: opts.flowId,
    dsl,
    lf: opts.lf,
    nodeId: opts.nodeId,
    mode: opts.mode,
  }
  await dispatchRun(ctx)
}
