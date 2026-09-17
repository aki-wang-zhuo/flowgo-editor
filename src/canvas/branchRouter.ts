/**
 * 分支节点（IF / SWITCH）出边 relation 辅助。
 */
import {
  parseSwitchCaseList,
  switchCaseKey,
  type SwitchCaseRow,
} from '@/components/editor/dynamic/switchCaseList'

export const REL_TRUE = 'True'
export const REL_FALSE = 'False'
export const REL_DEFAULT = 'Default'

/** @deprecated 使用 SwitchCaseRow；保留别名兼容旧引用 */
export type SwitchCaseItem = SwitchCaseRow

/** IF 可选出边 */
export function ifRelations(): string[] {
  return [REL_TRUE, REL_FALSE]
}

/** SWITCH 可选出边：cases.value 字符串键 + Default */
export function switchRelations(cases: SwitchCaseRow[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of cases || []) {
    const v = switchCaseKey(c.value)
    if (!v || v === REL_DEFAULT || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  out.push(REL_DEFAULT)
  return out
}

/** 连线展示文案 */
export function branchRelationLabel(
  relation: string,
  cases?: SwitchCaseRow[],
): string {
  if (relation === REL_TRUE) return 'True'
  if (relation === REL_FALSE) return 'False'
  if (relation === REL_DEFAULT) return 'Default'
  for (const c of cases || []) {
    if (switchCaseKey(c.value) === relation) {
      const n = (c.name || '').trim()
      return n || relation
    }
  }
  return relation
}

/** 从节点 configuration 读 SWITCH cases */
export function readSwitchCases(configuration: unknown): SwitchCaseRow[] {
  const conf = (configuration || {}) as Record<string, unknown>
  return parseSwitchCaseList(conf.cases)
}
