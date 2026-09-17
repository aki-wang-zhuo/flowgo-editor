/**
 * HTTP 响应自定义模板缓存：本地优先，无缓存再拉服务器。
 * 打开「模板管理」或增删改后由调用方刷新 / 写回。
 */
import {
  listHttpResponseTemplates,
  type HttpResponseCustomTemplate,
} from '@/api/settings'

const STORAGE_KEY = 'flowgo.httpResponseTemplates'

/** 当前进程内存；null 表示尚未从本地或服务器装载 */
let memory: HttpResponseCustomTemplate[] | null = null

function readStorage(): HttpResponseCustomTemplate[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as HttpResponseCustomTemplate[]
  } catch {
    return null
  }
}

function writeStorage(items: HttpResponseCustomTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // 配额满等忽略
  }
}

/** 读内存缓存；尚未装载则 null */
export function peekHttpResponseTemplates(): HttpResponseCustomTemplate[] | null {
  return memory
}

/** 写回内存 + localStorage（增删改后用） */
export function setHttpResponseTemplates(
  items: HttpResponseCustomTemplate[],
): void {
  memory = Array.isArray(items) ? items : []
  writeStorage(memory)
}

/**
 * 装载模板列表。
 * @param force 为 true 时强制打服务器（模板管理打开时）
 */
export async function loadHttpResponseTemplates(
  force = false,
): Promise<HttpResponseCustomTemplate[]> {
  if (!force) {
    if (memory != null) return memory
    const local = readStorage()
    if (local != null) {
      memory = local
      return memory
    }
  }
  const items = await listHttpResponseTemplates()
  setHttpResponseTemplates(items)
  return items
}
