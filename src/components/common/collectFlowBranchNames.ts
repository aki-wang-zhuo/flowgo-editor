/**
 * 收集流程中并发分组声明的线路名，供下游代码补全 msg.branches.xxx。
 */
import type { LfInstance } from '@/canvas/lf-types'
import { parseBranchList } from '@/components/editor/dynamic/branchList'

/** 所有 concurrentGroup 的线路名（去重排序） */
export function collectFlowBranchNames(
  lf: LfInstance | null | undefined,
): string[] {
  if (!lf?.getGraphData) return []
  const data = lf.getGraphData() as {
    nodes?: Array<{
      type?: string
      properties?: { configuration?: { branches?: unknown } }
    }>
  }
  const names = new Set<string>()
  for (const n of data.nodes || []) {
    if (n.type !== 'concurrentGroup') continue
    for (const b of parseBranchList(n.properties?.configuration?.branches)) {
      if (b.name) names.add(b.name)
    }
  }
  return [...names].sort()
}
