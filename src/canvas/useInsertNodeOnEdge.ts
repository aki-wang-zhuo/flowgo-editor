/**
 * 拖动节点到连线附近：高亮目标边；松手确认后插入节点（拆原边并重接）。
 * 仅左右锚点都有的节点可用；上游边保留原 relation，下游边为 Success。
 */
import { ElMessageBox } from 'element-plus'
import { t } from '@/i18n'
import { distPointToBezier, INSERT_HIGHLIGHT_KEY, type BezierPoint } from './bezier'
import type { LfInstance } from './lf-types'
import { isSilentSuccessSource } from './nodes/singleIOStyle'

/** 节点中心与曲线的吸附距离（画布坐标 px） */
const HIT_THRESHOLD = 28

type EdgeModelLike = {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceAnchorId?: string
  targetAnchorId?: string
  pointsList?: BezierPoint[]
  startPoint?: BezierPoint
  endPoint?: BezierPoint
  text?: string | { value?: string }
  properties?: Record<string, unknown>
}

type NodeModelLike = {
  id: string
  type?: string
  x: number
  y: number
  anchors?: Array<{ type?: string }>
  getDefaultAnchor?: () => Array<{ type?: string }>
}

function textValue(text: string | { value?: string } | undefined): string {
  if (!text) return ''
  if (typeof text === 'string') return text
  return text.value || ''
}

/**
 * 是否具备左右锚点（可同时作为连线目标与源）。
 * HTTP 入口/出口等单侧锚点节点不可插入。
 */
export function nodeHasBothAnchors(model: NodeModelLike | null | undefined): boolean {
  if (!model) return false
  const anchors =
    (typeof model.getDefaultAnchor === 'function'
      ? model.getDefaultAnchor()
      : model.anchors) || []
  let left = false
  let right = false
  for (const a of anchors) {
    if (a.type === 'left') left = true
    if (a.type === 'right') right = true
  }
  return left && right
}

/** 按类型粗判：入口仅出、出口仅入，不可插入到边中间 */
function typeHasBothAnchors(type: string | undefined): boolean {
  if (!type) return false
  return type !== 'inject' && type !== 'httpEndpoint' && type !== 'httpResponse'
}

function edgePoints(edge: EdgeModelLike): BezierPoint[] {
  if (Array.isArray(edge.pointsList) && edge.pointsList.length >= 2) {
    return edge.pointsList as BezierPoint[]
  }
  if (edge.startPoint && edge.endPoint) {
    return [edge.startPoint, edge.endPoint]
  }
  return []
}

function listEdges(lf: LfInstance): EdgeModelLike[] {
  const gm = lf.graphModel
  if (!gm) return []
  if (Array.isArray(gm.edges)) return gm.edges as EdgeModelLike[]
  if (typeof gm.getEdgeModels === 'function') {
    return (gm.getEdgeModels() || []) as EdgeModelLike[]
  }
  const map = gm.edgesMap as Record<string, { model?: EdgeModelLike }> | undefined
  if (map) {
    return Object.values(map)
      .map((e) => e?.model)
      .filter(Boolean) as EdgeModelLike[]
  }
  return []
}

/**
 * 在所有边中找与节点中心最近且在阈值内的一条（排除以该节点为端点的边）。
 */
function findNearestEdge(
  lf: LfInstance,
  nodeId: string,
  cx: number,
  cy: number,
): { edgeId: string; dist: number } | null {
  let best: { edgeId: string; dist: number } | null = null
  for (const edge of listEdges(lf)) {
    if (!edge?.id) continue
    if (edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId) continue
    const pts = edgePoints(edge)
    if (pts.length < 2) continue
    const dist = distPointToBezier(cx, cy, pts)
    if (dist > HIT_THRESHOLD) continue
    if (!best || dist < best.dist) best = { edgeId: edge.id, dist }
  }
  return best
}

function setEdgeHighlight(lf: LfInstance, edgeId: string | null, on: boolean) {
  if (!edgeId) return
  if (!lf.getEdgeModelById?.(edgeId)) return
  // setProperties 是合并写入：去掉键再 set 无法清除旧值，关闭时必须 deleteProperty
  if (on) {
    lf.setProperties?.(edgeId, { [INSERT_HIGHLIGHT_KEY]: true })
  } else {
    lf.deleteProperty?.(edgeId, INSERT_HIGHLIGHT_KEY)
  }
}

/**
 * 将节点插入指定边：改写原边终点为本节点（保留 relation / 锚点 / 文案），
 * 再新建本节点 → 原下游（Success）。不删原边，避免 HTTP 入口再次弹出路径选择。
 */
function insertNodeOnEdge(lf: LfInstance, nodeId: string, edgeId: string) {
  const edge = lf.getEdgeModelById?.(edgeId) as
    | (EdgeModelLike & {
        updateEndPoint?: (p: BezierPoint) => void
        resetTextPosition?: () => void
        updatePoints?: () => void
      })
    | undefined
  if (!edge) return false
  const sourceId = edge.sourceNodeId
  const oldTargetId = edge.targetNodeId
  if (!sourceId || !oldTargetId || sourceId === nodeId || oldTargetId === nodeId) {
    return false
  }

  const targetNode = lf.getNodeModelById?.(nodeId) as
    | {
        type?: string
        x: number
        y: number
        anchors?: Array<{ id?: string; x: number; y: number; type?: string }>
        getDefaultAnchor?: () => Array<{
          id?: string
          x: number
          y: number
          type?: string
        }>
      }
    | undefined
  if (!targetNode) return false

  // 去掉插入高亮（须 deleteProperty，setProperties 合并无法删键）
  lf.deleteProperty?.(edgeId, INSERT_HIGHLIGHT_KEY)

  const anchors =
    (typeof targetNode.getDefaultAnchor === 'function'
      ? targetNode.getDefaultAnchor()
      : targetNode.anchors) || []
  const left =
    anchors.find((a) => a.type === 'left') || anchors[0] || null

  // 直接改写上游边终点，不 delete + add（否则会触发 edge:add → HTTP 路径选择）
  edge.targetNodeId = nodeId
  if (left?.id) {
    edge.targetAnchorId = left.id
    edge.updateEndPoint?.({ x: left.x, y: left.y })
  } else {
    edge.targetAnchorId = undefined
    edge.updateEndPoint?.({ x: targetNode.x, y: targetNode.y })
  }
  // updateEndPoint 会重算贝塞尔；再校准标签位置
  if (textValue(edge.text)) {
    edge.resetTextPosition?.()
  }

  // 仅新建下游边（默认 Success）；静默类型不显示接线标签
  const rightAnchors = anchors.filter((a) => a.type === 'right')
  const outAnchor = rightAnchors[0] || null
  const silent = isSilentSuccessSource(targetNode.type)
  lf.addEdge?.({
    type: 'bezier',
    sourceNodeId: nodeId,
    targetNodeId: oldTargetId,
    sourceAnchorId: outAnchor?.id,
    text: silent ? '' : 'Success',
    properties: { relation: 'Success' },
  })

  return true
}

/**
 * 绑定拖入连线插入逻辑。
 * @returns 取消绑定
 */
export function bindInsertNodeOnEdge(lf: LfInstance): () => void {
  if (!lf) return () => undefined

  let highlightedId: string | null = null
  let pending = false

  function clearHighlight() {
    if (highlightedId) {
      setEdgeHighlight(lf, highlightedId, false)
      highlightedId = null
    }
  }

  function updateHighlight(
    nodeId: string,
    cx: number,
    cy: number,
    type?: string,
  ) {
    const node = nodeId
      ? (lf.getNodeModelById?.(nodeId) as NodeModelLike | undefined)
      : undefined
    const allowed = node
      ? nodeHasBothAnchors(node)
      : typeHasBothAnchors(type)
    if (!allowed) {
      clearHighlight()
      return
    }
    const hit = findNearestEdge(lf, nodeId || '__dnd__', cx, cy)
    const nextId = hit?.edgeId || null
    if (nextId === highlightedId) return
    clearHighlight()
    if (nextId) {
      setEdgeHighlight(lf, nextId, true)
      highlightedId = nextId
    }
  }

  async function tryInsert(nodeId: string, cx: number, cy: number) {
    const node = lf.getNodeModelById?.(nodeId) as NodeModelLike | undefined
    if (!nodeHasBothAnchors(node)) {
      clearHighlight()
      return
    }
    const nearest = findNearestEdge(lf, nodeId, cx, cy)
    const hit = nearest?.edgeId || null
    clearHighlight()
    if (!hit || pending) return
    pending = true
    try {
      await ElMessageBox.confirm(
        t('canvas.insertNode.message'),
        t('canvas.insertNode.title'),
        {
          confirmButtonText: t('canvas.insertNode.confirm'),
          cancelButtonText: t('common.cancel'),
          type: 'info',
          closeOnClickModal: false,
          distinguishCancelAndClose: true,
        },
      )
      insertNodeOnEdge(lf, nodeId, hit)
    } catch {
      /* 取消 */
    } finally {
      pending = false
    }
  }

  const onDrag = ({
    data,
  }: {
    data: { id?: string; x?: number; y?: number; type?: string }
  }) => {
    const id = String(data?.id || '')
    const model = id
      ? (lf.getNodeModelById?.(id) as NodeModelLike | undefined)
      : undefined
    const cx = Number(data?.x ?? model?.x)
    const cy = Number(data?.y ?? model?.y)
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return
    updateHighlight(id, cx, cy, data?.type || model?.type)
  }

  const onDrop = ({
    data,
  }: {
    data: { id?: string; x?: number; y?: number }
  }) => {
    const id = String(data?.id || '')
    if (!id) return
    const model = lf.getNodeModelById?.(id) as NodeModelLike | undefined
    const cx = Number(data?.x ?? model?.x)
    const cy = Number(data?.y ?? model?.y)
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
      clearHighlight()
      return
    }
    void tryInsert(id, cx, cy)
  }

  const onDragStart = () => {
    clearHighlight()
  }

  lf.on?.('node:dragstart', onDragStart)
  lf.on?.('node:drag', onDrag)
  lf.on?.('node:drop', onDrop)
  // 面板拖入：拖动预览高亮，放下后再确认
  lf.on?.('node:dnd-drag', onDrag)
  lf.on?.('node:dnd-add', onDrop)

  return () => {
    clearHighlight()
    lf.off?.('node:dragstart', onDragStart)
    lf.off?.('node:drag', onDrag)
    lf.off?.('node:drop', onDrop)
    lf.off?.('node:dnd-drag', onDrag)
    lf.off?.('node:dnd-add', onDrop)
  }
}
