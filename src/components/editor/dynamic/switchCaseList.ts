/**
 * SWITCH cases 列表解析 / 规范化。
 * 每项：匹配值 value、数据类型 type、分支名称 name。
 * 出边 relation / 引擎匹配使用 value 的字符串形式。
 */

export type SwitchCaseValueType = 'string' | 'number' | 'boolean'

export interface SwitchCaseRow {
  value: string | number | boolean
  type: SwitchCaseValueType
  name: string
}

const TYPES: SwitchCaseValueType[] = ['string', 'number', 'boolean']

function normalizeType(raw: unknown): SwitchCaseValueType {
  const s = String(raw || '').toLowerCase() as SwitchCaseValueType
  return TYPES.includes(s) ? s : 'string'
}

/** 出边 relation / 比较键（与引擎 fmt.Sprint 对齐） */
export function switchCaseKey(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value)
  }
  return String(value).trim()
}

function coerceValue(
  typ: SwitchCaseValueType,
  raw: unknown,
): string | number | boolean {
  if (typ === 'boolean') {
    return raw === true || raw === 'true' || raw === 1 || raw === '1'
  }
  if (typ === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }
  if (raw == null) return ''
  return String(raw)
}

/** 将 configuration.cases 规范为行数组 */
export function parseSwitchCaseList(raw: unknown): SwitchCaseRow[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) list = parsed
    } catch {
      list = []
    }
  }
  const out: SwitchCaseRow[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    let typ = normalizeType(o.type)
    // 无 type 时按 JSON 运行时类型推断（兼容旧 DSL）
    if (o.type == null || o.type === '') {
      if (typeof o.value === 'boolean') typ = 'boolean'
      else if (typeof o.value === 'number') typ = 'number'
      else typ = 'string'
    }
    const value = coerceValue(typ, o.value)
    const key = switchCaseKey(value)
    if (!key || key === 'Default' || seen.has(key)) continue
    seen.add(key)
    out.push({
      value,
      type: typ,
      name: String(o.name ?? '').trim(),
    })
  }
  return out
}

/** 写回 configuration：去重、按类型强制 value */
export function normalizeSwitchCaseList(list: SwitchCaseRow[]): SwitchCaseRow[] {
  const out: SwitchCaseRow[] = []
  const seen = new Set<string>()
  for (const row of list || []) {
    const typ = normalizeType(row?.type)
    const value = coerceValue(typ, row?.value)
    const key = switchCaseKey(value)
    if (!key || key === 'Default' || seen.has(key)) continue
    seen.add(key)
    out.push({
      value,
      type: typ,
      name: String(row?.name ?? '').trim(),
    })
  }
  return out
}

export function createDefaultSwitchCase(): SwitchCaseRow {
  return { value: '', type: 'string', name: '' }
}
