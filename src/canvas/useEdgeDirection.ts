/**
 * 连线方向归一：允许从左侧拉到对方右侧，但创建后立即翻转为「出→入」。
 * 合法拖拽：右→左（已正向）或 左→右（随后翻转）；同侧互连拒绝。
 */
import type { LfInstance } from './lf-types'

/** 从锚点 id / type 解析左右 */
function anchorSide(
  lf: LfInstance,
  nodeId: string,
  anchorId: string | undefined,
): 'left' | 'right' | '' {
  if (!anchorId) return ''
  const node = lf.getNodeModelById?.(nodeId) as
    | {
        anchors?: Array<{ id?: string; type?: string }>
        getDefaultAnchor?: () => Array<{ id?: string; type?: string }>
      }
    | undefined
  const list =
    node?.anchors ||
    (typeof node?.getDefaultAnchor === 'function'
      ? node.getDefaultAnchor()
      : []) ||
    []
  const hit = list.find((a) => a.id === anchorId)
  if (hit?.type === 'left' || hit?.type === 'right') return hit.type
  if (anchorId.endsWith('_left') || anchorId.includes('_left')) return 'left'
  if (anchorId.endsWith('_right') || anchorId.includes('_right')) return 'right'
  if (anchorId.includes('http-out')) return 'right'
  return ''
}

/**
 * 绑定 edge:add：左→右连线翻转为右→左；非法同侧连线删除。
 * 须先于其它 edge:add 处理器注册，以便后续处理器看到正向边。
 */
export function bindEdgeDirectionNormalize(lf: LfInstance): () => void {
  if (!lf) return () => undefined

  /** 正在翻转中新加的边，避免重复处理 */
  const skip = new Set<string>()

  const onAdd = ({ data }: { data: Record<string, unknown> }) => {
    const edgeId = String(data.id || '')
    if (!edgeId) return
    if (skip.has(edgeId)) {
      skip.delete(edgeId)
      return
    }

    const sourceNodeId = String(data.sourceNodeId || '')
    const targetNodeId = String(data.targetNodeId || '')
    if (!sourceNodeId || !targetNodeId) return

    // 禁止自环：自己的出连自己的入
    if (sourceNodeId === targetNodeId) {
      lf.deleteEdge?.(edgeId)
      return
    }

    const sourceSide = anchorSide(
      lf,
      sourceNodeId,
      data.sourceAnchorId as string | undefined,
    )
    const targetSide = anchorSide(
      lf,
      targetNodeId,
      data.targetAnchorId as string | undefined,
    )

    // 已是出→入
    if (sourceSide === 'right' && targetSide === 'left') return

    // 左→右：翻转为对方出 → 本节点入
    if (sourceSide === 'left' && targetSide === 'right') {
      const newSourceId = targetNodeId
      const newTargetId = sourceNodeId
      const newSource = lf.getNodeModelById?.(newSourceId) as
        | {
            isAllowConnectedAsSource?: (
              t: unknown,
              sa?: unknown,
              ta?: unknown,
            ) => boolean | { isAllPass?: boolean }
          }
        | undefined
      const newTarget = lf.getNodeModelById?.(newTargetId) as
        | {
            isAllowConnectedAsTarget?: (
              s: unknown,
              sa?: unknown,
              ta?: unknown,
            ) => boolean | { isAllPass?: boolean }
          }
        | undefined
      const srcAnchor = { id: `${newSourceId}_right`, type: 'right' }
      const tgtAnchor = { id: `${newTargetId}_left`, type: 'left' }
      const srcAllow = newSource?.isAllowConnectedAsSource?.(
        newTarget,
        srcAnchor,
        tgtAnchor,
      )
      const tgtAllow = newTarget?.isAllowConnectedAsTarget?.(
        newSource,
        srcAnchor,
        tgtAnchor,
      )
      const srcOk =
        srcAllow === undefined ||
        srcAllow === true ||
        (typeof srcAllow === 'object' && srcAllow.isAllPass !== false)
      const tgtOk =
        tgtAllow === undefined ||
        tgtAllow === true ||
        (typeof tgtAllow === 'object' && tgtAllow.isAllPass !== false)
      if (!srcOk || !tgtOk) {
        lf.deleteEdge?.(edgeId)
        return
      }

      const edgeType = String(data.type || 'bezier')
      const properties = {
        ...((data.properties as Record<string, unknown>) || {}),
      }
      lf.deleteEdge?.(edgeId)
      const created = lf.addEdge?.({
        type: edgeType,
        sourceNodeId: newSourceId,
        targetNodeId: newTargetId,
        sourceAnchorId: `${newSourceId}_right`,
        targetAnchorId: `${newTargetId}_left`,
        properties,
      }) as { id?: string } | undefined
      const newId = created?.id
      if (newId) skip.add(newId)
      return
    }

    // 同侧或无法识别：不允许
    if (sourceSide && targetSide) {
      lf.deleteEdge?.(edgeId)
    }
  }

  lf.on?.('edge:add', onAdd)
  return () => {
    lf.off?.('edge:add', onAdd)
  }
}
