/**
 * 宽松 JSON 格式化（编辑器用）：
 * - 支持 FlowGo 模板占位符 ${...}（裸值数组/对象、字符串内均可）
 * - 用 JSON5 解析无引号键名、尾逗号、单引号等
 * - 再用 JSON.stringify 输出标准缩进，并还原占位符
 */
import JSON5 from 'json5'
import { t as i18nT } from '@/i18n'

export interface FormatJsonResult {
  ok: boolean
  /** 成功时为格式化后的文本；失败时为空串 */
  text: string
  /** 失败原因（给人看） */
  error?: string
}

interface TplSlot {
  /** 临时 token（不含引号） */
  token: string
  /** 原始 ${...} */
  original: string
  /** true：出现在 JSON 字符串外（如数组/对象占位），解析时包成字符串 */
  bare: boolean
}

/**
 * 将 ${...} 临时替换为可解析的 JSON 片段，格式化后再还原。
 * 字符串内：仅替换占位符本体；字符串外裸占位：包成 "token"。
 */
function protectTemplates(raw: string): { text: string; slots: TplSlot[] } {
  const slots: TplSlot[] = []
  let out = ''
  let i = 0
  let inString = false
  let escape = false

  while (i < raw.length) {
    const c = raw[i]

    if (inString) {
      if (escape) {
        out += c
        escape = false
        i += 1
        continue
      }
      if (c === '\\') {
        out += c
        escape = true
        i += 1
        continue
      }
      if (c === '"') {
        inString = false
        out += c
        i += 1
        continue
      }
      if (c === '$' && raw[i + 1] === '{') {
        const end = raw.indexOf('}', i + 2)
        if (end >= 0) {
          const original = raw.slice(i, end + 1)
          const token = `__FG_TPL_${slots.length}__`
          slots.push({ token, original, bare: false })
          out += token
          i = end + 1
          continue
        }
      }
      out += c
      i += 1
      continue
    }

    if (c === '"') {
      inString = true
      out += c
      i += 1
      continue
    }
    if (c === '$' && raw[i + 1] === '{') {
      const end = raw.indexOf('}', i + 2)
      if (end >= 0) {
        const original = raw.slice(i, end + 1)
        const token = `__FG_TPL_${slots.length}__`
        slots.push({ token, original, bare: true })
        // 裸占位当作 JSON 字符串值，便于 JSON5 解析
        out += `"${token}"`
        i = end + 1
        continue
      }
    }
    out += c
    i += 1
  }

  return { text: out, slots }
}

/** 把格式化结果中的临时 token 还原为 ${...} */
function restoreTemplates(formatted: string, slots: TplSlot[]): string {
  let out = formatted
  // 先还原裸占位："token" → ${...}
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const s = slots[i]
    if (!s.bare) continue
    out = out.split(`"${s.token}"`).join(s.original)
  }
  // 再还原字符串内占位
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const s = slots[i]
    if (s.bare) continue
    out = out.split(s.token).join(s.original)
  }
  return out
}

/**
 * 将宽松 JSON / JSON5 / 含 ${...} 的模板格式化为缩进文本（2 空格）。
 * 空内容返回空串。
 */
export function formatJsonLoose(raw: string): FormatJsonResult {
  const trimmed = (raw || '').trim()
  if (!trimmed) {
    return { ok: true, text: '' }
  }
  try {
    const { text: protectedText, slots } = protectTemplates(trimmed)
    const value = JSON5.parse(protectedText)
    const pretty = JSON.stringify(value, null, 2)
    return { ok: true, text: restoreTemplates(pretty, slots) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, text: '', error: msg || i18nT('forms.jsonParseError') }
  }
}

/**
 * 宽松解析 JSON（编辑器校验用）；失败返回 null。
 * 含 ${...} 时按与格式化相同的保护规则再解析。
 */
export function parseJsonLoose(raw: string): unknown | null {
  const trimmed = (raw || '').trim()
  if (!trimmed) return {}
  try {
    const { text } = protectTemplates(trimmed)
    return JSON5.parse(text)
  } catch {
    return null
  }
}
