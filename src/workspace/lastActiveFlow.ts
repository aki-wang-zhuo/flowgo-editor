/**
 * 记住最后激活的流程 id，供刷新 / 下次打开自动恢复。
 */
const STORAGE_KEY = 'flowgo.lastActiveFlowId'

/** 读取上次激活的流程 id；无则 null */
export function readLastActiveFlowId(): string | null {
  try {
    const id = (localStorage.getItem(STORAGE_KEY) || '').trim()
    return id || null
  } catch {
    return null
  }
}

/** 写入或清除上次激活的流程 id */
export function writeLastActiveFlowId(id: string | null | undefined) {
  try {
    const v = (id || '').trim()
    if (!v) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, v)
  } catch {
    /* 隐私模式等忽略 */
  }
}
