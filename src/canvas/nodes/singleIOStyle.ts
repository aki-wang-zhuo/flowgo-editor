/**
 * 单入单出、出边无文案标签的节点（如 currentTime）。
 * relation 仍为 Success，仅画布不显示接线标签。
 */
import { t } from '@/i18n'
import { NodeRedModel, NodeRedView } from './nodeRedStyle'

/** 需要「静默 Success」出边的节点类型 */
export const SILENT_SUCCESS_TYPES = new Set(['currentTime'])

export function isSilentSuccessSource(type: string | undefined): boolean {
  return !!type && SILENT_SUCCESS_TYPES.has(type)
}

/**
 * 左入右出，最多一条出边。
 */
export class SingleIOModel extends NodeRedModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAllowConnectedAsSource(...args: any[]) {
    const outgoing =
      this.graphModel?.getNodeOutgoingEdge?.(this.id) ||
      this.outgoing?.edges ||
      []
    if ((outgoing as unknown[]).length >= 1) {
      return { isAllPass: false, msg: t('canvas.connection.maxOutgoing') }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (NodeRedModel.prototype.isAllowConnectedAsSource as any).apply(
      this,
      args,
    )
  }
}

export { NodeRedView as SingleIOView }
