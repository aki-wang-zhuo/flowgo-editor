/**
 * 编辑器调试控制台状态：显隐、高度与日志；高度/日志持久化到 localStorage。
 */
import { computed, ref } from 'vue'
import {
  newConsoleLogId,
  type ConsoleLogItem,
} from './types'

const MAX_LOGS = 500

const HEIGHT_KEY = 'flowgo.editor.console.height'
const LOGS_KEY = 'flowgo.editor.console.logs'
const AUTO_CLEAR_KEY = 'flowgo.editor.console.autoClear'

const DEFAULT_HEIGHT = 200
const MIN_HEIGHT = 100
const MAX_HEIGHT = 560

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** 从本地读取控制台高度 */
function readHeight(): number {
  try {
    const raw = localStorage.getItem(HEIGHT_KEY)
    if (raw == null) return DEFAULT_HEIGHT
    const n = Number(raw)
    if (!Number.isFinite(n)) return DEFAULT_HEIGHT
    return clamp(n, MIN_HEIGHT, MAX_HEIGHT)
  } catch {
    return DEFAULT_HEIGHT
  }
}

/** 写入控制台高度 */
function writeHeight(h: number) {
  try {
    localStorage.setItem(HEIGHT_KEY, String(h))
  } catch {
    /* 私有模式等写失败时忽略 */
  }
}

/** 读取「自动清空」开关（默认关） */
function readAutoClear(): boolean {
  try {
    return localStorage.getItem(AUTO_CLEAR_KEY) === '1'
  } catch {
    return false
  }
}

/** 写入「自动清空」开关 */
function writeAutoClear(on: boolean) {
  try {
    if (on) localStorage.setItem(AUTO_CLEAR_KEY, '1')
    else localStorage.removeItem(AUTO_CLEAR_KEY)
  } catch {
    /* ignore */
  }
}

/** 从本地读取日志列表 */
function readLogs(): ConsoleLogItem[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: ConsoleLogItem[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const r = row as Partial<ConsoleLogItem>
      const ft = String(r.flowType || 'INFO').toUpperCase()
      const flowType =
        ft === 'IN' || ft === 'OUT' || ft === 'ERROR' || ft === 'INFO'
          ? (ft as ConsoleLogItem['flowType'])
          : 'INFO'
      out.push({
        id: typeof r.id === 'string' ? r.id : newConsoleLogId(),
        ts: typeof r.ts === 'number' ? r.ts : Date.now(),
        flowType,
        nodeId: r.nodeId,
        nodeName: r.nodeName,
        relationType: r.relationType,
        data: r.data,
        err: r.err,
        durationMs: r.durationMs,
      })
    }
    return out.slice(-MAX_LOGS)
  } catch {
    return []
  }
}

/** 写入日志列表；空数组时删除键 */
function writeLogs(list: ConsoleLogItem[]) {
  try {
    if (!list.length) {
      localStorage.removeItem(LOGS_KEY)
      return
    }
    localStorage.setItem(LOGS_KEY, JSON.stringify(list))
  } catch {
    /* 配额或私有模式失败时忽略 */
  }
}

const visible = ref(false)
const height = ref(readHeight())
const logs = ref<ConsoleLogItem[]>(readLogs())
/** 每次调试运行前是否自动清空日志 */
const autoClear = ref(readAutoClear())

/** 控制台是否展开 */
export const consoleVisible = computed(() => visible.value)

/** 控制台高度（px） */
export const consoleHeight = computed(() => height.value)

/** 当前日志列表（只读视图） */
export const consoleLogs = computed(() => logs.value)

/** 是否开启运行前自动清空 */
export const consoleAutoClear = computed(() => autoClear.value)

/** 打开控制台 */
export function openConsole() {
  visible.value = true
}

/**
 * 调试运行开始：若开启自动清空则先清日志缓存，再打开控制台。
 */
export function prepareConsoleForRun() {
  if (autoClear.value) {
    clearConsole()
  }
  openConsole()
}

/** 设置自动清空开关（持久化） */
export function setConsoleAutoClear(on: boolean) {
  autoClear.value = !!on
  writeAutoClear(autoClear.value)
}

/** 关闭控制台 */
export function closeConsole() {
  visible.value = false
}

/** 切换控制台显隐 */
export function toggleConsole() {
  visible.value = !visible.value
}

/**
 * 设置控制台高度并可选立即持久化。
 * @param h 目标高度
 * @param persist 是否写入 localStorage（拖拽过程中为 false，松手后为 true）
 */
export function setConsoleHeight(h: number, persist = true) {
  height.value = clamp(h, MIN_HEIGHT, MAX_HEIGHT)
  if (persist) writeHeight(height.value)
}

/**
 * 开始拖拽调整高度（向上拖增高）。
 * 在 document 上监听 move/up，松手后写入本地。
 */
export function startConsoleHeightResize(e: MouseEvent) {
  e.preventDefault()
  const startY = e.clientY
  const startH = height.value
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'

  function onMove(ev: MouseEvent) {
    setConsoleHeight(startH + (startY - ev.clientY), false)
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    writeHeight(height.value)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

/** 清空日志（同步清空本地缓存） */
export function clearConsole() {
  logs.value = []
  writeLogs([])
}

function trimLogs() {
  if (logs.value.length > MAX_LOGS) {
    logs.value = logs.value.slice(-Math.floor(MAX_LOGS * 0.8))
  }
}

/** 追加一条日志；控制台关闭时也会写入，打开后可见，并缓存到本地 */
export function appendConsoleLog(
  partial: Omit<ConsoleLogItem, 'id' | 'ts'> & { ts?: number },
  opts?: { persist?: boolean },
) {
  const item: ConsoleLogItem = {
    id: newConsoleLogId(),
    ts: partial.ts ?? Date.now(),
    flowType: partial.flowType,
    nodeId: partial.nodeId,
    nodeName: partial.nodeName,
    relationType: partial.relationType,
    data: partial.data,
    err: partial.err,
    durationMs: partial.durationMs,
  }
  logs.value.push(item)
  trimLogs()
  if (opts?.persist !== false) writeLogs(logs.value)
  return item
}

/** 批量追加后端返回的调试日志（一次写入本地） */
export function appendServerDebugLogs(
  list: Array<{
    ts?: number
    flowType?: string
    nodeId?: string
    nodeName?: string
    relationType?: string
    data?: string
    err?: string
    durationMs?: number
  }>,
) {
  for (const raw of list || []) {
    const ft = String(raw.flowType || 'INFO').toUpperCase()
    const flowType =
      ft === 'IN' || ft === 'OUT' || ft === 'ERROR' ? ft : 'INFO'
    appendConsoleLog(
      {
        ts: raw.ts,
        flowType: flowType as ConsoleLogItem['flowType'],
        nodeId: raw.nodeId,
        nodeName: raw.nodeName,
        relationType: raw.relationType,
        data: raw.data,
        err: raw.err,
        durationMs: raw.durationMs,
      },
      { persist: false },
    )
  }
  writeLogs(logs.value)
}
