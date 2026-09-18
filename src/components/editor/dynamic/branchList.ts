/**
 * 并发分组线路列表：[{ name }]
 */
export interface BranchRow {
  name: string
}

/** 解析 configuration.branches（严格：去空、去重，供引擎/出边同步） */
export function parseBranchList(raw: unknown): BranchRow[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) list = raw
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw) as unknown
      if (Array.isArray(p)) list = p
    } catch {
      list = []
    }
  }
  const out: BranchRow[] = []
  const seen = new Set<string>()
  for (const it of list) {
    if (!it || typeof it !== 'object') continue
    const name = String((it as { name?: unknown }).name || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({ name })
  }
  return out
}

/**
 * 表单编辑态：保留空行，便于「添加线路」后继续填写；
 * 仍对非空名去重，并过滤 Success/Failure。
 */
export function coerceBranchListForEdit(raw: unknown): BranchRow[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) list = raw
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw) as unknown
      if (Array.isArray(p)) list = p
    } catch {
      list = []
    }
  }
  const out: BranchRow[] = []
  const seen = new Set<string>()
  const reserved = new Set(['Success', 'Failure'])
  for (const it of list) {
    if (it == null) {
      out.push({ name: '' })
      continue
    }
    if (typeof it !== 'object') continue
    const name = String((it as { name?: unknown }).name ?? '').trim()
    if (!name) {
      out.push({ name: '' })
      continue
    }
    if (reserved.has(name) || seen.has(name)) continue
    seen.add(name)
    out.push({ name })
  }
  return out.length ? out : [{ name: '' }]
}

/** 规范化写回（严格，供出边同步等） */
export function normalizeBranchList(rows: BranchRow[]): BranchRow[] {
  const out: BranchRow[] = []
  const seen = new Set<string>()
  const reserved = new Set(['Success', 'Failure'])
  for (const r of rows || []) {
    const name = String(r?.name || '').trim()
    if (!name || seen.has(name) || reserved.has(name)) continue
    seen.add(name)
    out.push({ name })
  }
  return out
}
