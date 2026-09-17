/**
 * 根据 ConfigField 推断 / 规范化控件类型。
 */
import type { ConfigField } from '@/types/flow'

export type ConfigWidget =
  | 'text'
  | 'textarea'
  | 'code-json'
  | 'code-js'
  | 'switch'
  | 'number'

/** 解析最终使用的 widget */
export function resolveWidget(field: ConfigField): ConfigWidget {
  const w = (field.widget || '').trim()
  if (
    w === 'text' ||
    w === 'textarea' ||
    w === 'code-json' ||
    w === 'code-js' ||
    w === 'switch' ||
    w === 'number'
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
