/**
 * 宽松 JSON 格式化（编辑器用）：
 * - 用 JSON5 解析无引号键名、尾逗号、单引号等
 * - 再用 JSON.stringify 输出标准 JSON（自动补双引号、去掉多余逗号）
 */
import JSON5 from 'json5'
import { t as i18nT } from '@/i18n'

export interface FormatJsonResult {
  ok: boolean
  /** 成功时为格式化后的标准 JSON；失败时为空串 */
  text: string
  /** 失败原因（给人看） */
  error?: string
}

/**
 * 将宽松 JSON / JSON5 文本格式化为标准 JSON（2 空格缩进）。
 * 空内容返回 "{}".
 */
export function formatJsonLoose(raw: string): FormatJsonResult {
  const trimmed = (raw || '').trim()
  if (!trimmed) {
    return { ok: true, text: '' }
  }
  try {
    const value = JSON5.parse(trimmed)
    return { ok: true, text: JSON.stringify(value, null, 2) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, text: '', error: msg || i18nT('forms.jsonParseError') }
  }
}

/**
 * 宽松解析 JSON（编辑器校验用）；失败返回 null。
 */
export function parseJsonLoose(raw: string): unknown | null {
  const trimmed = (raw || '').trim()
  if (!trimmed) return {}
  try {
    return JSON5.parse(trimmed)
  } catch {
    return null
  }
}
