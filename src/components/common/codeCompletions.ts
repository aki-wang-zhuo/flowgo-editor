/**
 * 代码编辑器内置补全：msg / metadata / msgType / dataType / global、
 * msg.__dataTime.*，以及流程 globalVars 声明的 global.xxx。
 */
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'

/** currentTime 写入的 __dataTime 字段 */
const DATA_TIME_FIELDS = [
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'millisecond',
  'timestamp',
  'timestampMs',
  'iso',
  'timezone',
] as const

/** 引擎统一暴露的顶层与常用路径 */
const BUILTIN_LABELS: Array<{ label: string; detail: string }> = [
  { label: 'msg', detail: 'message body' },
  { label: 'metadata', detail: 'message metadata' },
  { label: 'msgType', detail: 'message type' },
  { label: 'dataType', detail: 'data type' },
  { label: 'global', detail: 'flow globals' },
  { label: 'msg.__dataTime', detail: 'currentTime object' },
  ...DATA_TIME_FIELDS.map((f) => ({
    label: `msg.__dataTime.${f}`,
    detail: 'currentTime field',
  })),
]

function toOptions(
  items: Array<{ label: string; detail: string }>,
): Completion[] {
  return items.map((it) => ({
    label: it.label,
    type: 'variable',
    detail: it.detail,
  }))
}

/**
 * 构建 CodeMirror 自动补全扩展。
 * @param globalNames 本流程 globalVars 已声明的变量名（不含 global. 前缀）
 * @param branchNames 本流程 concurrentGroup 线路名（供 msg.branches.xxx）
 */
export function buildCodeCompletionsExtension(
  globalNames: string[] = [],
  branchNames: string[] = [],
): Extension {
  const extras = (globalNames || [])
    .map((n) => String(n || '').trim())
    .filter(Boolean)
    .map((name) => ({
      label: `global.${name}`,
      detail: 'flow global',
    }))

  const branchExtras: Array<{ label: string; detail: string }> = [
    { label: 'msg.branches', detail: 'concurrent group results' },
  ]
  for (const name of branchNames || []) {
    const n = String(name || '').trim()
    if (!n) continue
    branchExtras.push(
      { label: `msg.branches.${n}`, detail: 'branch outcome' },
      { label: `msg.branches.${n}.ok`, detail: 'branch ok' },
      { label: `msg.branches.${n}.msg`, detail: 'branch message' },
      { label: `msg.branches.${n}.error`, detail: 'branch error' },
    )
  }

  const options = toOptions([...BUILTIN_LABELS, ...extras, ...branchExtras])

  function source(context: CompletionContext): CompletionResult | null {
    // 匹配标识符 / 点路径，如 msg.__dataTime.ye
    const word = context.matchBefore(/[\w$.]+/)
    if (!word || (word.from === word.to && !context.explicit)) {
      return null
    }
    return {
      from: word.from,
      options,
      validFor: /^[\w$.]*$/,
    }
  }

  return autocompletion({ override: [source] })
}
