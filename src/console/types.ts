/**
 * 编辑器控制台日志条目（对齐后端 DebugLog，并支持前端本地摘要行）。
 */
export interface ConsoleLogItem {
  id: string
  ts: number
  flowType: 'IN' | 'OUT' | 'INFO' | 'ERROR'
  nodeId?: string
  nodeName?: string
  relationType?: string
  data?: string
  err?: string
  durationMs?: number
}

let seq = 0

/** 生成控制台条目 id */
export function newConsoleLogId(): string {
  seq += 1
  return `log-${Date.now()}-${seq}`
}
