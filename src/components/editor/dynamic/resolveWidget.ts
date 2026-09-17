/**
 * 根据 ConfigField 推断 / 规范化控件类型。
 * 对 [{method,path,name?,debugValue?}] 形态走结构化 router-list，避免整段 JSON 误改。
 */
import type { ConfigField } from '@/types/flow'
import { isRouterLikeItem } from '@/canvas/httpRouter'

export type ConfigWidget =
  | 'text'
  | 'textarea'
  | 'code-json'
  | 'code-js'
  | 'switch'
  | 'number'
  | 'select'
  | 'router-list'
  | 'var-list'
  | 'case-list'

/**
 * 是否应按「HTTP 路由列表」结构化编辑。
 * - widget 显式为 router-list
 * - 字段名 routers + array（后端现仍可能下发 code-json）
 * - default JSON 数组元素像 {method,path,...}
 */
export function isRouterListField(field: ConfigField): boolean {
  const w = (field.widget || '').trim()
  if (w === 'router-list') return true

  const type = (field.type || '').toLowerCase()
  if (field.name === 'routers' && type === 'array') return true

  if (type === 'array' && field.default) {
    try {
      const parsed = JSON.parse(field.default) as unknown
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        isRouterLikeItem(parsed[0])
      ) {
        return true
      }
    } catch {
      // default 非 JSON 则忽略
    }
  }
  return false
}

/** 是否应按 SWITCH cases 结构化列表编辑 */
export function isCaseListField(field: ConfigField): boolean {
  const w = (field.widget || '').trim()
  if (w === 'case-list') return true
  // 兼容旧 catalog：cases 数组
  if (field.name === 'cases' && (field.type || '').toLowerCase() === 'array') {
    return true
  }
  return false
}

/** 解析最终使用的 widget */
export function resolveWidget(field: ConfigField): ConfigWidget {
  // 路由列表优先：即使后端标了 code-json 也走结构化编辑
  if (isRouterListField(field)) return 'router-list'
  if (isCaseListField(field)) return 'case-list'

  const w = (field.widget || '').trim()
  if (
    w === 'var-list' ||
    (field.name === 'variables' && (field.type || '').toLowerCase() === 'array')
  ) {
    return 'var-list'
  }
  if (
    w === 'text' ||
    w === 'textarea' ||
    w === 'code-json' ||
    w === 'code-js' ||
    w === 'switch' ||
    w === 'number' ||
    w === 'select'
  ) {
    return w
  }
  switch ((field.type || '').toLowerCase()) {
    case 'boolean':
      return 'switch'
    case 'number':
      return 'number'
    case 'object':
    case 'array':
      return 'code-json'
    default:
      return 'text'
  }
}
