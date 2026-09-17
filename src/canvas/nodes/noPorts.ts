/**
 * 无端口节点模型：不可连入、不可连出（如全局变量）。
 */
import { t } from '@/i18n'
import { NodeRedModel, NodeRedView } from './nodeRedStyle'

/**
 * 无锚点基类。
 */
export class NoPortsModel extends NodeRedModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAllowConnectedAsSource(..._args: any[]) {
    return { isAllPass: false, msg: t('canvas.connection.noPortsNode') }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAllowConnectedAsTarget(..._args: any[]) {
    return { isAllPass: false, msg: t('canvas.connection.noPortsNode') }
  }

  /** 无锚点 */
  getDefaultAnchor() {
    return []
  }
}

export { NodeRedView as NoPortsView }
