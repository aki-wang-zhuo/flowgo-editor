/**
 * 运行处理器注册表：按匹配顺序取第一个命中的 runner。
 */
import type { RunContext, RunHandlerMatch } from './types'
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'

const handlers: RunHandlerMatch[] = []

/** 注册一种运行方式（后注册可插到前面以覆盖） */
export function registerRunHandler(handler: RunHandlerMatch, prepend = false) {
  if (prepend) handlers.unshift(handler)
  else handlers.push(handler)
}

/** 查找并执行匹配的 runner；无匹配时提示 */
export async function dispatchRun(ctx: RunContext): Promise<boolean> {
  const hit = handlers.find((h) => {
    try {
      return h.match(ctx)
    } catch {
      return false
    }
  })
  if (!hit) {
    ElMessage.warning(t('runners.noRunner'))
    return false
  }
  await hit.run(ctx)
  return true
}

/** 测试用：清空注册表 */
export function clearRunHandlers() {
  handlers.length = 0
}
