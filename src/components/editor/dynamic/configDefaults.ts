/**
 * ConfigField.Default 解析与拖拽默认 configuration 生成。
 */
import type { ConfigField } from '@/types/flow'
import { resolveWidget } from './resolveWidget'

/** 将后端 Default 字符串按字段类型转为运行时值 */
export function parseFieldDefault(field: ConfigField): unknown {
  const raw = field.default
  if (raw == null || raw === '') {
    const w = resolveWidget(field)
    if (w === 'switch') return false
    if (w === 'number') return 0
    if (field.type === 'object') return {}
    if (field.type === 'array') return []
    return ''
  }
  const t = (field.type || '').toLowerCase()
  if (t === 'boolean') {
    return raw === 'true' || raw === '1'
  }
  if (t === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }
  if (t === 'object' || t === 'array') {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return t === 'array' ? [] : {}
    }
  }
  return raw
}

/** 由 configFields 生成拖拽时的 configuration；无字段时回退 defaultScript */
export function buildDefaultsFromFields(
  fields: ConfigField[] | undefined,
  defaultScript?: string,
): Record<string, unknown> {
  if (!fields?.length) {
    return defaultScript ? { jsScript: defaultScript } : {}
  }
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (!f.name) continue
    out[f.name] = parseFieldDefault(f)
  }
  return out
}

/**
 * 读节点 configuration 中某字段的展示值（代码类转为字符串）。
 */
export function readFieldDisplayValue(
  field: ConfigField,
  conf: Record<string, unknown>,
): unknown {
  const has = Object.prototype.hasOwnProperty.call(conf, field.name)
  const raw = has ? conf[field.name] : parseFieldDefault(field)
  const w = resolveWidget(field)
  if (w === 'code-json' || w === 'code-js') {
    if (typeof raw === 'string') return raw
    try {
      return JSON.stringify(raw ?? (field.type === 'array' ? [] : {}), null, 2)
    } catch {
      return String(raw ?? '')
    }
  }
  if (w === 'switch') {
    if (typeof raw === 'boolean') return raw
    return raw === 'true' || raw === 1 || raw === '1'
  }
  if (w === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }
  return raw ?? ''
}

/**
 * 将控件编辑值写回 configuration（object/array 尝试 JSON.parse）。
 */
export function writeFieldValue(field: ConfigField, uiValue: unknown): unknown {
  const w = resolveWidget(field)
  const t = (field.type || '').toLowerCase()
  if (w === 'switch') return !!uiValue
  if (w === 'number') {
    const n = Number(uiValue)
    return Number.isFinite(n) ? n : 0
  }
  if (w === 'code-json' && (t === 'object' || t === 'array')) {
    const text = String(uiValue ?? '').trim()
    if (!text) return t === 'array' ? [] : {}
    try {
      return JSON.parse(text) as unknown
    } catch {
      // 保留原文，避免模板半成品丢失
      return text
    }
  }
  if (w === 'code-json' || w === 'code-js' || w === 'textarea' || w === 'text') {
    return uiValue == null ? '' : String(uiValue)
  }
  return uiValue
}
