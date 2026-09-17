/**
 * 测试运行出错时：将失败节点标红，并驱动画布错误气泡。
 * 多 Tab 通过订阅按 lf 实例过滤，互不干扰。
 */
import type { LfInstance } from '@/canvas/lf-types'

/** 节点 properties 上的错误标记（驱动描边） */
export const RUN_ERROR_PROP = 'runError'

export interface RunNodeError {
  nodeId: string
  message: string
}

type Listener = (lf: LfInstance, error: RunNodeError | null) => void

const listeners = new Set<Listener>()

/** 订阅运行错误展示（FlowCanvas 挂载时注册） */
export function subscribeRunError(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function emit(lf: LfInstance, error: RunNodeError | null) {
  for (const fn of listeners) {
    try {
      fn(lf, error)
    } catch {
      /* 忽略监听方异常 */
    }
  }
}

/** 清除画布上全部运行错误标红与气泡 */
export function clearRunErrors(lf: LfInstance | null | undefined) {
  if (!lf) return
  const data = lf.getGraphData?.() as { nodes?: { id: string }[] } | undefined
  for (const n of data?.nodes || []) {
    const model = lf.getNodeModelById?.(n.id) as
      | { properties?: Record<string, unknown> }
      | undefined
    if (model?.properties?.[RUN_ERROR_PROP]) {
      lf.deleteProperty?.(n.id, RUN_ERROR_PROP)
    }
  }
  emit(lf, null)
}

/**
 * 从引擎错误文案 / DebugLog 解析失败节点。
 * 引擎格式多为：`node <id>: <msg>` 或 `init node <id>: <msg>`。
 */
export function resolveRunError(
  opts: {
    error?: string
    logs?: Array<{ nodeId?: string; err?: string }>
    fallbackNodeId?: string
  },
): RunNodeError | null {
  const logs = opts.logs || []
  for (let i = logs.length - 1; i >= 0; i--) {
    const row = logs[i]
    if (row?.err && row.nodeId) {
      return { nodeId: row.nodeId, message: row.err }
    }
  }
  const err = (opts.error || '').trim()
  if (!err) return null

  const m =
    err.match(/^init\s+node\s+(\S+?):\s*([\s\S]+)$/i) ||
    err.match(/^node\s+(\S+?):\s*([\s\S]+)$/i)
  if (m) {
    return { nodeId: m[1], message: (m[2] || err).trim() || err }
  }
  if (opts.fallbackNodeId) {
    return { nodeId: opts.fallbackNodeId, message: err }
  }
  return null
}

/** 标红指定节点并弹出错误气泡 */
export function showRunNodeError(
  lf: LfInstance,
  nodeId: string,
  message: string,
) {
  clearRunErrors(lf)
  const model = lf.getNodeModelById?.(nodeId)
  if (!model) {
    // 节点不在图上时仍通知气泡（可能无法定位，由 UI 决定）
    emit(lf, { nodeId, message })
    return
  }
  lf.setProperties?.(nodeId, { [RUN_ERROR_PROP]: true })
  emit(lf, { nodeId, message })
}

/**
 * 根据一次模拟运行结果应用错误高亮；无错误则清除。
 */
export function applyRunResultErrors(
  lf: LfInstance,
  opts: {
    error?: string
    logs?: Array<{ nodeId?: string; err?: string }>
    fallbackNodeId?: string
  },
) {
  const resolved = resolveRunError(opts)
  if (!resolved) {
    clearRunErrors(lf)
    return
  }
  showRunNodeError(lf, resolved.nodeId, resolved.message)
}
