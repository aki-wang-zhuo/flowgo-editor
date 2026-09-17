/**
 * 出口类节点模型：仅左侧入线（无出）。
 * 允许「从本节点左侧临时连到对方右侧」，随后由方向归一翻成 对方出→本节点入。
 */
import { t } from '@/i18n'
import { NodeRedModel } from './nodeRedStyle'

/**
 * 出口仅入基类。
 */
export class ExitOnlyInModel extends NodeRedModel {
  /**
   * 默认禁止出边；仅允许左→右的临时连线（翻转后本节点为入边终点）。
   * 使用 rest 参数以兼容 LogicFlow BaseNodeModel 签名。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAllowConnectedAsSource(...args: any[]) {
    const target = args[0] as { id?: string } | undefined
    const sourceAnchor = args[1] as { type?: string } | undefined
    const targetAnchor = args[2] as { type?: string } | undefined
    if (target?.id && target.id === this.id) {
      return { isAllPass: false, msg: t('canvas.connection.noSelfLoop') }
    }
    if (sourceAnchor?.type === 'left' && targetAnchor?.type === 'right') {
      return { isAllPass: true, msg: '' }
    }
    return { isAllPass: false, msg: t('canvas.connection.exitNoOutgoing') }
  }

  /** 仅左侧入线锚点 */
  getDefaultAnchor() {
    const { x, y, id, width } = this
    return [
      {
        x: x - width / 2,
        y,
        id: `${id}_left`,
        type: 'left',
      },
    ]
  }
}
