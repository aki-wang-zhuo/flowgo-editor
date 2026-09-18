/**
 * 并发分组出边 / 入边规则：
 * - 从 fork（公共并发入）扇出：选线路名
 * - 从 right 出组：Success / Failure
 * - 连到 joinOk / joinFail：自动 Success / Failure
 */
import type { LfInstance } from './lf-types'
import { parseBranchList } from '@/components/editor/dynamic/branchList'
import { pickBranchRelation } from './pickBranchRelation'
import {
  CG_ANCHOR,
  cgAnchorRole,
  isCgForkAnchor,
  isCgJoinAnchor,
} from './nodes/concurrentGroupStyle'
import { t } from '@/i18n'

const REL_SUCCESS = 'Success'
const REL_FAILURE = 'Failure'

/** 从节点 configuration 读取线路名 */
export function readConcurrentBranches(conf: unknown): string[] {
  const cfg =
    conf && typeof conf === 'object'
      ? (conf as { branches?: unknown })
      : undefined
  return parseBranchList(cfg?.branches).map((b) => b.name)
}

/** 出组可选 relation */
export function concurrentExitRelations(): string[] {
  return [REL_SUCCESS, REL_FAILURE]
}

function relationLabel(relation: string): string {
  if (relation === REL_SUCCESS) return t('canvas.jsEdge.successLabel')
  if (relation === REL_FAILURE) return t('canvas.jsEdge.failureLabel')
  return relation
}

function usedRelations(
  lf: LfInstance,
  sourceId: string,
  excludeEdgeId?: string,
): Set<string> {
  const used = new Set<string>()
  const edges = (lf.getNodeEdges?.(sourceId) || []) as Array<{
    id: string
    sourceNodeId: string
    properties?: Record<string, unknown>
  }>
  for (const e of edges) {
    if (e.id === excludeEdgeId || e.sourceNodeId !== sourceId) continue
    const rel = String(e.properties?.relation || '').trim()
    if (rel) used.add(rel)
  }
  return used
}

function bindEdgeRelation(
  lf: LfInstance,
  edgeId: string,
  relation: string,
  baseProps?: Record<string, unknown>,
  blankText = false,
) {
  lf.setProperties?.(edgeId, {
    ...(baseProps || {}),
    relation,
  })
  lf.updateText?.(edgeId, blankText ? '' : relationLabel(relation))
}

/**
 * branches 变更后：仅裁剪 fork 扇出边中已删除的线路名；出组 Success/Failure 保留。
 */
export function syncConcurrentGroupNode(lf: LfInstance, nodeId: string) {
  if (!lf || !nodeId) return
  const model = lf.getNodeModelById?.(nodeId) as
    | { type?: string; properties?: Record<string, unknown> }
    | undefined
  if (!model || model.type !== 'concurrentGroup') return

  const branches = new Set(readConcurrentBranches(model.properties?.configuration))
  const exit = new Set(concurrentExitRelations())
  const edges = (lf.getNodeEdges?.(nodeId) || []) as Array<{
    id: string
    sourceNodeId: string
    sourceAnchorId?: string
    properties?: Record<string, unknown>
  }>
  const seen = new Set<string>()
  for (const e of edges) {
    if (e.sourceNodeId !== nodeId) continue
    const rel = String(e.properties?.relation || '')
    const role = cgAnchorRole(e.sourceAnchorId)
    // 出组边
    if (role === CG_ANCHOR.right || (!role && exit.has(rel))) {
      if (!exit.has(rel) || seen.has(`exit:${rel}`)) {
        lf.deleteEdge?.(e.id)
        continue
      }
      seen.add(`exit:${rel}`)
      bindEdgeRelation(lf, e.id, rel, e.properties)
      continue
    }
    // 扇出边
    if (!branches.has(rel) || seen.has(`fork:${rel}`)) {
      lf.deleteEdge?.(e.id)
      continue
    }
    seen.add(`fork:${rel}`)
    // 扇出文案用线路名本身
    lf.setProperties?.(e.id, { ...(e.properties || {}), relation: rel })
    lf.updateText?.(e.id, rel)
  }
}

/** 重选并发分组出边（fork 线路或 right 出组） */
export async function rebindConcurrentGroupEdgeRelation(
  lf: LfInstance,
  edgeId: string,
): Promise<boolean> {
  if (!lf || !edgeId) return false
  const edge = lf.getEdgeModelById?.(edgeId) as
    | {
        id: string
        sourceNodeId: string
        sourceAnchorId?: string
        properties?: Record<string, unknown>
      }
    | undefined
  if (!edge) return false
  const source = lf.getNodeModelById?.(edge.sourceNodeId)
  if (!source || source.type !== 'concurrentGroup') return false

  const role = cgAnchorRole(edge.sourceAnchorId)
  const used = usedRelations(lf, edge.sourceNodeId, edgeId)
  const current = String(edge.properties?.relation || '').trim()

  let options: { relation: string; label: string }[] = []
  if (role === CG_ANCHOR.right) {
    options = concurrentExitRelations()
      .filter((r) => !used.has(r) || r === current)
      .map((r) => ({ relation: r, label: relationLabel(r) }))
  } else {
    const branches = readConcurrentBranches(source.properties?.configuration)
    options = branches
      .filter((r) => !used.has(r) || r === current)
      .map((r) => ({ relation: r, label: r }))
  }

  const rel = await pickBranchRelation(options)
  if (!rel) return false
  if (role === CG_ANCHOR.right) {
    bindEdgeRelation(lf, edgeId, rel, edge.properties)
  } else {
    lf.setProperties?.(edgeId, { ...(edge.properties || {}), relation: rel })
    lf.updateText?.(edgeId, rel)
  }
  return true
}

/** 绑定 concurrentGroup 连线事件 */
export function bindConcurrentGroupEdgeRules(lf: LfInstance): () => void {
  if (!lf) return () => undefined
  const pending = new Set<string>()

  const onAdd = async ({ data }: { data: Record<string, unknown> }) => {
    const sourceId = String(data.sourceNodeId || '')
    const targetId = String(data.targetNodeId || '')
    const edgeId = String(data.id || '')
    if (!edgeId || !lf.getEdgeModelById?.(edgeId)) return
    if (pending.has(edgeId)) return
    pending.add(edgeId)

    try {
      const source = sourceId ? lf.getNodeModelById?.(sourceId) : undefined
      const target = targetId ? lf.getNodeModelById?.(targetId) : undefined
      const sourceAnchorId = String(data.sourceAnchorId || '')
      const targetAnchorId = String(data.targetAnchorId || '')
      const srcRole = cgAnchorRole(sourceAnchorId)
      const tgtRole = cgAnchorRole(targetAnchorId)

      // 连到汇合锚点：自动 relation
      if (target?.type === 'concurrentGroup' && isCgJoinAnchor(targetAnchorId)) {
        const rel =
          tgtRole === CG_ANCHOR.joinFail ? REL_FAILURE : REL_SUCCESS
        bindEdgeRelation(
          lf,
          edgeId,
          rel,
          data.properties as Record<string, unknown> | undefined,
        )
        return
      }

      // 外部进入左锚点
      if (target?.type === 'concurrentGroup' && tgtRole === CG_ANCHOR.left) {
        bindEdgeRelation(
          lf,
          edgeId,
          REL_SUCCESS,
          data.properties as Record<string, unknown> | undefined,
          true,
        )
        return
      }

      // 从「进入」口反向拉出：交给方向归一翻成外部→本组，此处不处理
      if (srcRole === CG_ANCHOR.left) return

      if (source?.type !== 'concurrentGroup') return

      const used = usedRelations(lf, sourceId, edgeId)
      let options: { relation: string; label: string }[] = []

      if (srcRole === CG_ANCHOR.right) {
        options = concurrentExitRelations()
          .filter((r) => !used.has(r))
          .map((r) => ({ relation: r, label: relationLabel(r) }))
      } else if (isCgForkAnchor(sourceAnchorId) || srcRole === '') {
        const branches = readConcurrentBranches(source.properties?.configuration)
        options = branches
          .filter((r) => !used.has(r))
          .map((r) => ({ relation: r, label: r }))
      } else {
        lf.deleteEdge?.(edgeId)
        return
      }

      const rel = await pickBranchRelation(options)
      if (!rel) {
        lf.deleteEdge?.(edgeId)
        return
      }
      if (srcRole === CG_ANCHOR.right) {
        bindEdgeRelation(
          lf,
          edgeId,
          rel,
          data.properties as Record<string, unknown> | undefined,
        )
      } else {
        lf.setProperties?.(edgeId, {
          ...((data.properties as Record<string, unknown>) || {}),
          relation: rel,
        })
        lf.updateText?.(edgeId, rel)
      }
    } finally {
      pending.delete(edgeId)
    }
  }

  lf.on?.('edge:add', onAdd)
  return () => {
    lf.off?.('edge:add', onAdd)
  }
}

/** 兼容旧调用：线路名 + 出组 */
export function concurrentGroupRelations(branchNames: string[]): string[] {
  return [...branchNames, ...concurrentExitRelations()]
}
