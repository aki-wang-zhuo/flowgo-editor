/**
 * 从画布 LogicFlow 图数据中收集本流程 globalVars 节点已声明的变量名。
 */
import type { LfInstance } from '@/canvas/lf-types'
import { parseGlobalVarList } from '@/components/editor/dynamic/globalVarList'

/** 读取图中唯一（或全部）globalVars 节点的 variables.name */
export function collectFlowGlobalNames(
  lf: LfInstance | null | undefined,
): string[] {
  if (!lf?.getGraphData) return []
  const data = lf.getGraphData() as {
    nodes?: Array<{
      type?: string
      properties?: {
        configuration?: { variables?: unknown }
      }
    }>
  }
  const names = new Set<string>()
  for (const n of data.nodes || []) {
    if (n.type !== 'globalVars') continue
    const list = parseGlobalVarList(n.properties?.configuration?.variables)
    for (const item of list) {
      const name = String(item.name || '').trim()
      if (name) names.add(name)
    }
  }
  return [...names].sort()
}
