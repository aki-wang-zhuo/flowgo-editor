/**
 * JS 转换 / HTTP 客户端：左入右出；右侧最多 2 条出边（Success / Failure）。
 */
import { t } from '@/i18n'
import { NodeRedModel, NodeRedView } from './nodeRedStyle'

/**
 * Success/Failure 双出边模型（锚点同 Node-RED，出边上限 2）。
 */
export class JsTransformModel extends NodeRedModel {
  /**
   * 右侧最多两条出边，并保留父类方向校验。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAllowConnectedAsSource(...args: any[]) {
    const outgoing =
      this.graphModel?.getNodeOutgoingEdge?.(this.id) ||
      this.outgoing?.edges ||
      []
    if ((outgoing as unknown[]).length >= 2) {
      return { isAllPass: false, msg: t('canvas.jsEdge.maxTwo') }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (NodeRedModel.prototype.isAllowConnectedAsSource as any).apply(
      this,
      args,
    )
  }
}

/** 复用 Node-RED 视图外观 */
export { NodeRedView as JsTransformView }
