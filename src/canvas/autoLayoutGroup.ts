/**
 * 并发分组框内自动布局：子节点落在组内边距内，必要时撑大组框。
 */
import type { LfInstance } from './lf-types'
import { CG_ANCHOR, cgAnchorRole } from './nodes/concurrentGroupStyle'
import {
  AUTO_LAYOUT_DEFAULTS,
  bbox,
  nodeGeom,
  runDagre,
  GROUP_PAD,
  GROUP_TYPE,
} from './autoLayoutShared'

/**
 * 组内布局：子节点 + 虚拟 fork/汇聚，结果落在组框内边距内；必要时撑大组框。
 */
export function layoutGroupInterior(
  lf: LfInstance,
  groupId: string,
  profile: typeof AUTO_LAYOUT_DEFAULTS,
) {
  const gm = lf.graphModel
  if (!gm) return

  const group = lf.getNodeModelById?.(groupId) as
    | {
        id: string
        type?: string
        x?: number
        y?: number
        width?: number
        height?: number
        children?: Set<string> | string[]
        properties?: Record<string, unknown>
        moveTo?: (x: number, y: number) => void
        setProperties?: (p: Record<string, unknown>) => void
        updateExpandedSize?: (w: number, h: number) => void
        setTextPosition?: () => void
      }
    | undefined
  if (!group || group.type !== GROUP_TYPE) return

  const childIds = group.children
    ? Array.from(group.children as Set<string> | string[]).map(String)
    : []
  if (childIds.length === 0) return

  const children = childIds
    .map((id) => {
      const m = lf.getNodeModelById?.(id)
      return m ? nodeGeom(lf, { id, ...(m as object) } as Parameters<typeof nodeGeom>[1]) : null
    })
    .filter((n): n is NonNullable<typeof n> => !!n)

  if (children.length === 0) return

  const childSet = new Set(children.map((c) => c.id))
  const forkId = `${groupId}__layout_fork`
  const joinOkId = `${groupId}__layout_joinOk`
  const joinFailId = `${groupId}__layout_joinFail`

  const dummyNodes = [
    { id: forkId, width: 8, height: 8 },
    { id: joinOkId, width: 8, height: 8 },
    { id: joinFailId, width: 8, height: 8 },
  ]

  const interiorEdges: Array<{ source: string; target: string }> = []
  const edges = (gm.edges || []) as Array<{
    sourceNodeId: string
    targetNodeId: string
    sourceAnchorId?: string
    targetAnchorId?: string
  }>

  for (const e of edges) {
    const src = e.sourceNodeId
    const tgt = e.targetNodeId
    const srcIn = childSet.has(src)
    const tgtIn = childSet.has(tgt)

    if (srcIn && tgtIn) {
      interiorEdges.push({ source: src, target: tgt })
      continue
    }
    if (src === groupId && tgtIn && cgAnchorRole(e.sourceAnchorId) === CG_ANCHOR.fork) {
      interiorEdges.push({ source: forkId, target: tgt })
      continue
    }
    if (srcIn && tgt === groupId) {
      const role = cgAnchorRole(e.targetAnchorId)
      if (role === CG_ANCHOR.joinFail) {
        interiorEdges.push({ source: src, target: joinFailId })
      } else if (role === CG_ANCHOR.joinOk || role === CG_ANCHOR.left) {
        interiorEdges.push({ source: src, target: joinOkId })
      }
    }
  }

  const dagreNodes = [
    ...children.map((c) => ({ id: c.id, width: c.width, height: c.height })),
    ...dummyNodes,
  ]
  const pos = runDagre(dagreNodes, interiorEdges, {
    rankdir: profile.rankdir,
    ranksep: Math.min(profile.ranksep, 120),
    nodesep: Math.min(profile.nodesep, 56),
    marginx: 16,
    marginy: 16,
  })

  const childPos = children.map((c) => {
    const p = pos.get(c.id)!
    return { id: c.id, x: p.x, y: p.y, width: c.width, height: c.height }
  })
  const contentBox = bbox(childPos)

  const contentW = contentBox.maxX - contentBox.minX
  const contentH = contentBox.maxY - contentBox.minY
  const needW = contentW + GROUP_PAD.left + GROUP_PAD.right
  const needH = contentH + GROUP_PAD.top + GROUP_PAD.bottom

  const curW = Number(group.width) || needW
  const curH = Number(group.height) || needH
  const newW = Math.max(curW, needW)
  const newH = Math.max(curH, needH)

  if (newW !== curW || newH !== curH) {
    group.width = newW
    group.height = newH
    group.updateExpandedSize?.(newW, newH)
    const conf = {
      ...((group.properties?.configuration as Record<string, unknown>) || {}),
      width: newW,
      height: newH,
    }
    group.setProperties?.({
      ...(group.properties || {}),
      width: newW,
      height: newH,
      configuration: conf,
    })
    group.setTextPosition?.()
  }

  const gx = Number(group.x) || 0
  const gy = Number(group.y) || 0
  const innerLeft = gx - newW / 2 + GROUP_PAD.left
  const innerTop = gy - newH / 2 + GROUP_PAD.top
  const innerW = newW - GROUP_PAD.left - GROUP_PAD.right
  const innerH = newH - GROUP_PAD.top - GROUP_PAD.bottom

  const offsetX = innerLeft + innerW / 2 - (contentBox.minX + contentBox.maxX) / 2
  const offsetY = innerTop + innerH / 2 - (contentBox.minY + contentBox.maxY) / 2

  for (const c of childPos) {
    gm.moveNode2Coordinate(c.id, c.x + offsetX, c.y + offsetY, true)
  }
}
