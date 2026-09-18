/**
 * 并发分组创建后的初始化（默认 branches / 尺寸）；不再创建 groupEnd/groupFail 节点。
 */
import type { LfInstance } from '@/canvas/lf-types'
import { CG_DEFAULT_HEIGHT, CG_DEFAULT_WIDTH } from './nodes/concurrentGroupStyle'

/**
 * 确保 concurrentGroup 具备默认 configuration（线路、完成机制等）。
 */
export function ensureConcurrentGroupJoins(lf: LfInstance, groupId: string) {
  const model = lf.getNodeModelById?.(groupId) as
    | {
        type?: string
        width?: number
        height?: number
        properties?: Record<string, unknown>
      }
    | undefined
  if (!model || model.type !== 'concurrentGroup') return

  const conf = {
    ...((model.properties?.configuration as Record<string, unknown>) || {}),
  }
  const w = model.width || CG_DEFAULT_WIDTH
  const h = model.height || CG_DEFAULT_HEIGHT

  if (!Array.isArray(conf.branches) || !(conf.branches as unknown[]).length) {
    conf.branches = [{ name: 'branch1' }, { name: 'branch2' }]
  }
  conf.width = w
  conf.height = h
  conf.completeMode = conf.completeMode || 'all'
  conf.cancelOthersOnAny =
    conf.cancelOthersOnAny === undefined ? true : conf.cancelOthersOnAny
  conf.timeoutSec = conf.timeoutSec ?? 10
  // 不再使用独立汇合节点
  delete conf.joinSuccessId
  delete conf.joinFailId

  lf.setProperties?.(groupId, {
    ...(model.properties || {}),
    configuration: conf,
  })
}

/** 绑定：拖入 concurrentGroup 后写入默认配置 */
export function bindConcurrentGroupAutoJoin(lf: LfInstance) {
  const onAdd = ({ data }: { data?: { id?: string; type?: string } }) => {
    if (data?.type === 'concurrentGroup' && data.id) {
      requestAnimationFrame(() => ensureConcurrentGroupJoins(lf, data.id!))
    }
  }
  lf.on?.('node:dnd-add', onAdd)
  return () => {
    lf.off?.('node:dnd-add', onAdd)
  }
}
