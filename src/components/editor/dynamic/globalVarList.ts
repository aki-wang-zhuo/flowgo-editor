/**
 * 全局变量列表解析 / 规范化。
 */

export type GlobalVarType = 'string' | 'number' | 'boolean' | 'json'

export interface GlobalVarItem {
  name: string
  type: GlobalVarType
  value: unknown
}

const TYPES: GlobalVarType[] = ['string', 'number', 'boolean', 'json']

function normalizeType(raw: unknown): GlobalVarType {
  const s = String(raw || '').toLowerCase() as GlobalVarType
  return TYPES.includes(s) ? s : 'string'
}

/** 将 configuration.variables 规范为数组 */
export function parseGlobalVarList(raw: unknown): GlobalVarItem[] {
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
  return list.map((item) => {
    if (!item || typeof item !== 'object') {
      return { name: '', type: 'string' as const, value: '' }
    }
    const o = item as Record<string, unknown>
    return {
      name: String(o.name ?? ''),
      type: normalizeType(o.type),
      value: o.value,
    }
  })
}

export function normalizeGlobalVarList(list: GlobalVarItem[]): GlobalVarItem[] {
  return (list || []).map((row) => ({
    name: String(row?.name ?? '').trim(),
    type: normalizeType(row?.type),
    value: row?.value,
  }))
}
