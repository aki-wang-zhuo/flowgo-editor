/**
 * 分支节点（IF / SWITCH）出边 relation 辅助。
 */
export const REL_TRUE = 'True'
export const REL_FALSE = 'False'
export const REL_DEFAULT = 'Default'

export interface SwitchCaseItem {
  value: string
  name?: string
}

/** IF 可选出边 */
export function ifRelations(): string[] {
  return [REL_TRUE, REL_FALSE]
}

/** SWITCH 可选出边：cases.value + Default */
export function switchRelations(cases: SwitchCaseItem[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of cases || []) {
    const v = String(c.value || '').trim()
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
  cases?: SwitchCaseItem[],
): string {
  if (relation === REL_TRUE) return 'True'
  if (relation === REL_FALSE) return 'False'
  if (relation === REL_DEFAULT) return 'Default'
  for (const c of cases || []) {
    if (c.value === relation) {
      const n = (c.name || '').trim()
      return n || relation
    }
  }
  return relation
}

/** 从节点 configuration 读 SWITCH cases */
export function readSwitchCases(configuration: unknown): SwitchCaseItem[] {
  const conf = (configuration || {}) as Record<string, unknown>
  const raw = conf.cases
  if (!Array.isArray(raw)) return []
  const out: SwitchCaseItem[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const r = (item || {}) as Record<string, unknown>
    const value = String(r.value || '').trim()
    if (!value || value === REL_DEFAULT || seen.has(value)) continue
    seen.add(value)
    out.push({ value, name: String(r.name || '') })
  }
  return out
}
