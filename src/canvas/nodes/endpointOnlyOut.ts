/**
 * 入口类节点模型：仅右侧出线（无入）。
 * 允许「从对方左侧临时连到本节点右侧」，随后由方向归一翻成 本节点出→对方入。
 */
import { t } from '@/i18n'
import { NodeRedModel } from './nodeRedStyle'

/**
 * 入口仅出基类；子类可覆盖 maxOutgoing。
 */
export class EndpointOnlyOutModel extends NodeRedModel {
  /** 最大出边数，默认 1 */
  protected maxOutgoing(): number {
    return 1
  }

  /**
   * 默认禁止入边；仅允许左→右的临时连线（翻转后本节点为出边源）。
   * 使用 rest 参数以兼容 LogicFlow BaseNodeModel 签名。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAllowConnectedAsTarget(...args: any[]) {
    const source = args[0] as { id?: string } | undefined
    const sourceAnchor = args[1] as { type?: string } | undefined
    const targetAnchor = args[2] as { type?: string } | undefined
    if (source?.id && source.id === this.id) {
      return { isAllPass: false, msg: t('canvas.connection.noSelfLoop') }
    }
    if (sourceAnchor?.type === 'left' && targetAnchor?.type === 'right') {
      return { isAllPass: true, msg: '' }
    }
    return { isAllPass: false, msg: t('canvas.connection.entryNoIncoming') }
  }

  /** 出边上限 + 父类方向 / 禁自环规则 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAllowConnectedAsSource(...args: any[]) {
    const outgoing =
      this.graphModel?.getNodeOutgoingEdge?.(this.id) ||
      this.outgoing?.edges ||
      []
    if ((outgoing as unknown[]).length >= this.maxOutgoing()) {
      return { isAllPass: false, msg: t('canvas.connection.maxOutgoing') }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (NodeRedModel.prototype.isAllowConnectedAsSource as any).apply(
      this,
      args,
    )
  }

  /** 仅右侧出线锚点 */
  getDefaultAnchor() {
    const { x, y, id, width } = this
    return [
      {
        x: x + width / 2,
        y,
        id: `${id}_right`,
        type: 'right',
      },
    ]
  }
}
