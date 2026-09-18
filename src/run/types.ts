/**
 * 可扩展「运行」上下文：不同节点/连线可注册不同 runner。
 */
import type { FlowDSL } from '@/types/flow'
import type { LfInstance } from '@/canvas/lf-types'

/** 连线运行上下文 */
export interface EdgeRunContext {
  kind: 'edge'
  flowId: string
  dsl: FlowDSL
  lf: LfInstance
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  relation?: string
  routerIndex?: number
}

/** 节点运行上下文 */
export interface NodeRunContext {
  kind: 'node'
  flowId: string
  dsl: FlowDSL
  lf: LfInstance
  nodeId: string
  /** run = 从此节点运行；runOnly = 仅此节点 */
  mode: 'run' | 'runOnly' | 'test'
}

export type RunContext = EdgeRunContext | NodeRunContext

export type RunHandler = (ctx: RunContext) => Promise<void>

export interface RunHandlerMatch {
  /** 是否匹配该上下文 */
  match: (ctx: RunContext) => boolean
  /** 执行 */
  run: RunHandler
  /** 展示名，便于调试 */
  name: string
}
