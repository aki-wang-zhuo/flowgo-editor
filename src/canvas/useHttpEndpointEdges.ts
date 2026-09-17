/**
 * HTTP 入口连线规则：单一出锚点；连成后弹出路径选择，取消则删边。
 */
import type { LfInstance } from './lf-types'
import {
  readRouters,
  routerLabel,
  routerRelation,
} from './httpRouter'
import { pickHttpRouter } from './pickHttpRouter'
import { t } from '@/i18n'

/** 读取出边已占用的路由下标（可排除某条边） */
function usedRouterIndexes(
  lf: LfInstance,
  sourceId: string,
  excludeEdgeId?: string,
): Set<number> {
  const used = new Set<number>()
  const edges = (lf.getNodeEdges?.(sourceId) || []) as Array<{
    id: string
    sourceNodeId: string
    properties?: Record<string, unknown>
  }>
  for (const e of edges) {
    if (e.id === excludeEdgeId || e.sourceNodeId !== sourceId) continue
    const u = Number(e.properties?.routerIndex)
    if (Number.isFinite(u) && u >= 0) used.add(u)
  }
  return used
}

/**
 * 将出边绑定到指定路由槽，并刷新文案；锚点始终为唯一出线点。
 */
export function bindEdgeToRouter(
  lf: LfInstance,
  edgeId: string,
  sourceId: string,
  idx: number,
  routers: ReturnType<typeof readRouters>,
  baseProps?: Record<string, unknown>,
) {
  const r = routers[idx]
  if (!r) return
  lf.setProperties?.(edgeId, {
    ...(baseProps || {}),
    relation: routerRelation(r),
    routerIndex: idx,
  })
  lf.updateText?.(edgeId, routerLabel(r))
  const edgeModel = lf.getEdgeModelById?.(edgeId)
  if (edgeModel) {
    edgeModel.sourceAnchorId = `${sourceId}_right`
  }
}

/**
 * 为已有 HTTP 出边重新选择请求路径。
 * 取消或未变更返回 false；成功换绑返回 true。
 */
export async function rebindHttpEdgePath(
  lf: LfInstance,
  edgeId: string,
): Promise<boolean> {
  if (!lf || !edgeId) return false
  const edge = lf.getEdgeModelById?.(edgeId) as
    | {
        id: string
        sourceNodeId: string
        properties?: Record<string, unknown>
      }
    | undefined
  if (!edge) return false
  const sourceId = edge.sourceNodeId
  const source = lf.getNodeModelById?.(sourceId)
  if (source?.type !== 'httpEndpoint') return false

  const routers = readRouters(source.properties?.configuration)
  const used = usedRouterIndexes(lf, sourceId, edgeId)
  const free = routers
    .map((router, index) => ({ index, router }))
    .filter((o) => !used.has(o.index))

  const current = Number(edge.properties?.routerIndex)
  const idx = await pickHttpRouter(free, {
    title: t('canvas.pickHttp.reselectTitle'),
    hint: t('canvas.pickHttp.reselectHint'),
    preferredIndex: Number.isFinite(current) ? current : undefined,
  })
  if (idx == null || idx < 0 || idx >= routers.length) return false
  if (idx === current) return false

  bindEdgeToRouter(lf, edgeId, sourceId, idx, routers, edge.properties)
  return true
}

/**
 * 节点 routers 变更后：刷新锚点，并更新/裁剪出边文案与 relation。
 */
export function syncHttpEndpointNode(lf: LfInstance, nodeId: string) {
  if (!lf || !nodeId) return
  const model = lf.getNodeModelById?.(nodeId) as
    | {
        type?: string
        setAttributes?: () => void
        refreshAnchor?: () => void
        properties?: Record<string, unknown>
      }
    | undefined
  if (!model || model.type !== 'httpEndpoint') return

  model.setAttributes?.()
  model.refreshAnchor?.()

  const routers = readRouters(model.properties?.configuration)
  const edges = (lf.getNodeEdges?.(nodeId) || []) as Array<{
    id: string
    sourceNodeId: string
    properties?: Record<string, unknown>
  }>

  const seen = new Set<number>()
  for (const e of edges) {
    if (e.sourceNodeId !== nodeId) continue
    let idx = Number(e.properties?.routerIndex)
    if (!Number.isFinite(idx) || idx < 0) {
      const rel = String(e.properties?.relation || '')
      idx = routers.findIndex((r) => routerRelation(r) === rel)
    }
    // 下标越界或重复占用 → 删除
    if (idx < 0 || idx >= routers.length || seen.has(idx)) {
      lf.deleteEdge?.(e.id)
      continue
    }
    seen.add(idx)
    bindEdgeToRouter(lf, e.id, nodeId, idx, routers, e.properties)
  }
}

/**
 * 绑定 LogicFlow 事件，约束 httpEndpoint 的连线行为。
 * @returns 取消绑定函数
 */
export function bindHttpEndpointEdgeRules(lf: LfInstance): () => void {
  if (!lf) return () => undefined

  /** 防止选择弹窗期间重复处理同一条边 */
  const pending = new Set<string>()

  const onAdd = async ({ data }: { data: Record<string, unknown> }) => {
    const sourceId = String(data.sourceNodeId || '')
    const edgeId = String(data.id || '')
    if (!sourceId || !edgeId) return
    // 方向归一可能已删除本边并重建
    if (!lf.getEdgeModelById?.(edgeId)) return

    const source = lf.getNodeModelById?.(sourceId)
    if (source?.type !== 'httpEndpoint') return
    if (pending.has(edgeId)) return
    pending.add(edgeId)

    try {
      const routers = readRouters(source.properties?.configuration)
      const used = usedRouterIndexes(lf, sourceId, edgeId)
      const free = routers
        .map((router, index) => ({ index, router }))
        .filter((o) => !used.has(o.index))

      // 始终弹窗选择；取消或不选 → 删除连线
      const idx = await pickHttpRouter(free)
      if (idx == null || idx < 0 || idx >= routers.length || used.has(idx)) {
        lf.deleteEdge?.(edgeId)
        return
      }

      bindEdgeToRouter(
        lf,
        edgeId,
        sourceId,
        idx,
        routers,
        data.properties as Record<string, unknown> | undefined,
      )
    } finally {
      pending.delete(edgeId)
    }
  }

  lf.on?.('edge:add', onAdd)
  return () => {
    lf.off?.('edge:add', onAdd)
  }
}
