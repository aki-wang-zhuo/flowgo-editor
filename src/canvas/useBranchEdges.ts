/**
 * 分支节点连线规则：连成后选择出口（True/False 或 case/Default）；取消则删边。
 */
import type { LfInstance } from './lf-types'
import {
  REL_DEFAULT,
  branchRelationLabel,
  ifRelations,
  readSwitchCases,
  switchRelations,
} from './branchRouter'
import { pickBranchRelation } from './pickBranchRelation'
import { t } from '@/i18n'

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
    text?: string | { value?: string }
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
  label: string,
  baseProps?: Record<string, unknown>,
) {
  lf.setProperties?.(edgeId, {
    ...(baseProps || {}),
    relation,
  })
  lf.updateText?.(edgeId, label)
}

/**
 * SWITCH cases 变更后：裁剪无效出边并刷新文案。
 */
export function syncSwitchNode(lf: LfInstance, nodeId: string) {
  if (!lf || !nodeId) return
  const model = lf.getNodeModelById?.(nodeId) as
    | { type?: string; properties?: Record<string, unknown> }
    | undefined
  if (!model || model.type !== 'switch') return

  const cases = readSwitchCases(model.properties?.configuration)
  const allowed = new Set(switchRelations(cases))
  const edges = (lf.getNodeEdges?.(nodeId) || []) as Array<{
    id: string
    sourceNodeId: string
    properties?: Record<string, unknown>
  }>
  const seen = new Set<string>()
  for (const e of edges) {
    if (e.sourceNodeId !== nodeId) continue
    const rel = String(e.properties?.relation || '')
    if (!allowed.has(rel) || seen.has(rel)) {
      lf.deleteEdge?.(e.id)
      continue
    }
    seen.add(rel)
    bindEdgeRelation(
      lf,
      e.id,
      rel,
      branchRelationLabel(rel, cases),
      e.properties,
    )
  }
}

/**
 * 重新选择分支出边关系（浮动栏「重选」）。
 * @returns 是否成功换绑
 */
export async function rebindBranchEdgeRelation(
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

  const source = lf.getNodeModelById?.(edge.sourceNodeId)
  if (!source || (source.type !== 'if' && source.type !== 'switch')) return false

  const used = usedRelations(lf, edge.sourceNodeId, edgeId)
  const current = String(edge.properties?.relation || '').trim()
  let options: { relation: string; label: string }[] = []

  if (source.type === 'if') {
    options = ifRelations()
      .filter((r) => !used.has(r) || r === current)
      .map((r) => ({ relation: r, label: r }))
  } else {
    const cases = readSwitchCases(source.properties?.configuration)
    options = switchRelations(cases)
      .filter((r) => !used.has(r) || r === current)
      .map((r) => ({
        relation: r,
        label: branchRelationLabel(r, cases),
      }))
  }

  const rel = await pickBranchRelation(options)
  if (!rel) return false

  const cases =
    source.type === 'switch'
      ? readSwitchCases(source.properties?.configuration)
      : undefined
  bindEdgeRelation(
    lf,
    edgeId,
    rel,
    branchRelationLabel(rel, cases),
    edge.properties,
  )
  return true
}

/**
 * 绑定分支节点连线事件。
 */
export function bindBranchEdgeRules(lf: LfInstance): () => void {
  if (!lf) return () => undefined

  const pending = new Set<string>()

  const onAdd = async ({ data }: { data: Record<string, unknown> }) => {
    const sourceId = String(data.sourceNodeId || '')
    const edgeId = String(data.id || '')
    if (!sourceId || !edgeId) return
    if (!lf.getEdgeModelById?.(edgeId)) return

    const source = lf.getNodeModelById?.(sourceId)
    if (!source) return
    if (source.type !== 'if' && source.type !== 'switch') return
    if (pending.has(edgeId)) return
    pending.add(edgeId)

    try {
      const used = usedRelations(lf, sourceId, edgeId)
      let options: { relation: string; label: string }[] = []

      if (source.type === 'if') {
        options = ifRelations()
          .filter((r) => !used.has(r))
          .map((r) => ({ relation: r, label: r }))
      } else {
        const cases = readSwitchCases(source.properties?.configuration)
        options = switchRelations(cases)
          .filter((r) => !used.has(r))
          .map((r) => ({
            relation: r,
            label: branchRelationLabel(r, cases),
          }))
      }

      const rel = await pickBranchRelation(options)
      if (!rel) {
        lf.deleteEdge?.(edgeId)
        return
      }

      const cases =
        source.type === 'switch'
          ? readSwitchCases(source.properties?.configuration)
          : undefined
      bindEdgeRelation(
        lf,
        edgeId,
        rel,
        branchRelationLabel(rel, cases),
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

/** 供表单默认 cases */
export function defaultSwitchCases() {
  return [
    { value: 'a', name: t('nodePalette.defaultBranchA') },
    { value: 'b', name: t('nodePalette.defaultBranchB') },
  ]
}

export { REL_DEFAULT }
