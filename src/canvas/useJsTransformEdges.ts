/**
 * Success / Failure 双出边节点（jsTransform、httpClient）：
 * 视觉单出口锚点可连两条线；第一条默认 Success，第二条 Failure；
 * 仅一条出边时可切换 Success / Failure。
 */
import { ElMessage } from 'element-plus'
import type { LfInstance } from './lf-types'
import { pickBranchRelation } from './pickBranchRelation'
import { t } from '@/i18n'

const REL_SUCCESS = 'Success'
const REL_FAILURE = 'Failure'

/** 支持 Success/Failure 双出边的节点类型 */
const SUCCESS_FAILURE_TYPES = new Set(['jsTransform', 'httpClient'])

/**
 * 是否为 Success/Failure 双出边源节点。
 */
export function isSuccessFailureSource(type: string | undefined): boolean {
  return !!type && SUCCESS_FAILURE_TYPES.has(type)
}

function outgoingFrom(
  lf: LfInstance,
  sourceId: string,
): Array<{
  id: string
  sourceNodeId: string
  properties?: Record<string, unknown>
}> {
  const edges = (lf.getNodeEdges?.(sourceId) || []) as Array<{
    id: string
    sourceNodeId: string
    properties?: Record<string, unknown>
  }>
  return edges.filter((e) => e.sourceNodeId === sourceId)
}

function usedRelations(
  lf: LfInstance,
  sourceId: string,
  excludeEdgeId?: string,
): Set<string> {
  const used = new Set<string>()
  for (const e of outgoingFrom(lf, sourceId)) {
    if (e.id === excludeEdgeId) continue
    const rel = String(e.properties?.relation || '').trim()
    if (rel) used.add(rel)
  }
  return used
}

/** 源节点出边是否恰好 1 条（才允许切换 Success/Failure） */
export function canRebindJsEdgeRelation(
  lf: LfInstance,
  edgeId: string,
): boolean {
  if (!lf || !edgeId) return false
  const edge = lf.getEdgeModelById?.(edgeId) as
    | { sourceNodeId?: string }
    | undefined
  if (!edge?.sourceNodeId) return false
  const source = lf.getNodeModelById?.(edge.sourceNodeId)
  if (!isSuccessFailureSource(source?.type)) return false
  return outgoingFrom(lf, edge.sourceNodeId).length === 1
}

/**
 * 仅一条出边时弹出选择 Success / Failure。
 * @returns 是否成功换绑
 */
export async function rebindJsEdgeRelation(
  lf: LfInstance,
  edgeId: string,
): Promise<boolean> {
  if (!canRebindJsEdgeRelation(lf, edgeId)) {
    ElMessage.warning(t('canvas.jsEdge.cannotToggle'))
    return false
  }
  const edge = lf.getEdgeModelById?.(edgeId) as
    | {
        id: string
        sourceNodeId: string
        properties?: Record<string, unknown>
      }
    | undefined
  if (!edge) return false

  const current = String(edge.properties?.relation || REL_SUCCESS).trim()
  const rel = await pickBranchRelation(
    [
      { relation: REL_SUCCESS, label: t('canvas.jsEdge.successLabel') },
      { relation: REL_FAILURE, label: t('canvas.jsEdge.failureLabel') },
    ],
    {
      title: t('canvas.jsEdge.pickTitle'),
      hint: t('canvas.jsEdge.pickHint'),
      preferred: current === REL_FAILURE ? REL_FAILURE : REL_SUCCESS,
    },
  )
  if (!rel) return false

  lf.setProperties?.(edgeId, {
    ...(edge.properties || {}),
    relation: rel,
  })
  lf.updateText?.(edgeId, rel)
  return true
}

/**
 * 绑定 Success/Failure 节点连线事件（jsTransform / httpClient）。
 */
export function bindJsTransformEdgeRules(lf: LfInstance): () => void {
  if (!lf) return () => undefined

  const onAdd = ({ data }: { data: Record<string, unknown> }) => {
    const sourceId = String(data.sourceNodeId || '')
    const edgeId = String(data.id || '')
    if (!sourceId || !edgeId) return
    if (!lf.getEdgeModelById?.(edgeId)) return

    const source = lf.getNodeModelById?.(sourceId)
    if (!isSuccessFailureSource(source?.type)) return

    const used = usedRelations(lf, sourceId, edgeId)
    let rel = ''
    if (!used.has(REL_SUCCESS)) {
      rel = REL_SUCCESS
    } else if (!used.has(REL_FAILURE)) {
      rel = REL_FAILURE
    } else {
      ElMessage.warning(t('canvas.jsEdge.maxTwo'))
      lf.deleteEdge?.(edgeId)
      return
    }

    lf.setProperties?.(edgeId, {
      ...((data.properties as Record<string, unknown>) || {}),
      relation: rel,
    })
    lf.updateText?.(edgeId, rel)
  }

  lf.on?.('edge:add', onAdd)
  return () => {
    lf.off?.('edge:add', onAdd)
  }
}
