/**
 * 并发分组画布模型：组框 + 固定锚点。
 * 锚点 type 仅用 left/right（与全局连线规则兼容）；角色靠 id 后缀区分。
 * - *_left：组框左缘「进入」——外部连入；也可从此反向拉线（随后翻转为正向）
 * - *_fork：组内左侧「公共并发入」（仅作起点，type=right）
 * - *_joinOk / *_joinFail：组内右侧成功 / 失败汇聚（仅作终点，type=left）
 * - *_right：组框右缘「出组」——连到外部（仅作起点，Success/Failure）
 */
import { h, type Point } from '@logicflow/core'
import { DynamicGroupNode, DynamicGroupNodeModel } from '@logicflow/extension'
import type LogicFlow from '@logicflow/core'
import { t } from '@/i18n'

/** 默认分组框尺寸 */
export const CG_DEFAULT_WIDTH = 480
export const CG_DEFAULT_HEIGHT = 320

/** 锚点角色（与 id 后缀一致） */
export const CG_ANCHOR = {
  left: 'left',
  fork: 'fork',
  joinOk: 'joinOk',
  joinFail: 'joinFail',
  right: 'right',
} as const

export type CgAnchorRole = (typeof CG_ANCHOR)[keyof typeof CG_ANCHOR]

/** 从锚点 id 解析并发分组角色 */
export function cgAnchorRole(anchorId?: string): CgAnchorRole | '' {
  const id = String(anchorId || '')
  if (!id) return ''
  if (id.endsWith('_fork') || id.includes('_fork')) return CG_ANCHOR.fork
  if (id.endsWith('_joinOk') || id.includes('_joinOk')) return CG_ANCHOR.joinOk
  if (id.endsWith('_joinFail') || id.includes('_joinFail')) return CG_ANCHOR.joinFail
  if (id.endsWith('_left') || id.includes('_left')) return CG_ANCHOR.left
  if (id.endsWith('_right') || id.includes('_right')) return CG_ANCHOR.right
  return ''
}

/** 是否为组内汇合锚点 */
export function isCgJoinAnchor(anchorIdOrRole?: string): boolean {
  const r = cgAnchorRole(anchorIdOrRole) || anchorIdOrRole
  return r === CG_ANCHOR.joinOk || r === CG_ANCHOR.joinFail
}

/** 是否为公共并发入（扇出）锚点 */
export function isCgForkAnchor(anchorIdOrRole?: string): boolean {
  const r = cgAnchorRole(anchorIdOrRole) || anchorIdOrRole
  return r === CG_ANCHOR.fork
}

export class ConcurrentGroupModel extends DynamicGroupNodeModel {
  initNodeData(data: LogicFlow.NodeConfig) {
    super.initNodeData(data)
    this.width =
      Number(data.properties?.configuration?.width) ||
      Number(data.properties?.width) ||
      CG_DEFAULT_WIDTH
    this.height =
      Number(data.properties?.configuration?.height) ||
      Number(data.properties?.height) ||
      CG_DEFAULT_HEIGHT
    this.radius = 8
    this.isRestrict = false
    this.autoResize = true
    this.collapsible = false
    // 允许选中后拖四角改宽高（非画布缩放）；全局还需 allowResize=true
    this.resizable = true
    // 改宽高时不缩放组内子节点
    this.transformWithContainer = false
    this.properties = {
      ...(this.properties || {}),
      allowEdgeConnect: true,
    }
  }

  /**
   * 拖角调整宽高后写入 configuration，便于落库。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resize(resizeInfo: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (DynamicGroupNodeModel.prototype.resize as any).call(
      this,
      resizeInfo,
    )
    const conf = {
      ...((this.properties?.configuration as Record<string, unknown>) || {}),
      width: this.width,
      height: this.height,
    }
    this.setProperties({
      ...(this.properties || {}),
      width: this.width,
      height: this.height,
      configuration: conf,
    })
    return data
  }

  getResizeControlStyle() {
    const style = super.getResizeControlStyle?.() || {}
    return {
      ...style,
      width: 10,
      height: 10,
      fill: '#fff',
      stroke: '#5c6bc0',
      strokeWidth: 1.5,
    }
  }

  getResizeOutlineStyle() {
    const style = super.getResizeOutlineStyle?.() || {}
    return {
      ...style,
      stroke: '#7986cb',
      strokeWidth: 1,
      strokeDasharray: '4 2',
      fill: 'none',
    }
  }

  /**
   * DynamicGroup 默认把锚点画成透明；对外左右端必须可见可点。
   */
  getAnchorStyle(anchorInfo?: { id?: string; type?: string }) {
    const role = cgAnchorRole(anchorInfo?.id)
    const base = {
      r: 5,
      stroke: '#5c6bc0',
      strokeWidth: 1.5,
      fill: '#fff',
      hover: {
        fill: '#5c6bc0',
        stroke: '#3949ab',
        r: 6,
      },
    }
    if (role === CG_ANCHOR.left) {
      return {
        ...base,
        stroke: '#43a047',
        hover: { ...base.hover, fill: '#43a047', stroke: '#2e7d32' },
      }
    }
    if (role === CG_ANCHOR.right) {
      return {
        ...base,
        stroke: '#5c6bc0',
        fill: '#e8eaf6',
        hover: { ...base.hover, fill: '#5c6bc0', stroke: '#3949ab' },
      }
    }
    // 组内 fork / 汇聚：由 getShape 标注圆点，锚点本体略透明以免叠层过重
    if (
      role === CG_ANCHOR.fork ||
      role === CG_ANCHOR.joinOk ||
      role === CG_ANCHOR.joinFail
    ) {
      return {
        ...base,
        fill: 'rgba(255,255,255,0.85)',
        stroke:
          role === CG_ANCHOR.joinFail
            ? '#e53935'
            : role === CG_ANCHOR.joinOk
              ? '#43a047'
              : '#5c6bc0',
      }
    }
    return base
  }

  getNodeStyle() {
    const style = super.getNodeStyle()
    return {
      ...style,
      fill: 'rgba(197, 202, 233, 0.25)',
      stroke: '#7986cb',
      strokeWidth: 2,
      strokeDasharray: '6 3',
    }
  }

  /**
   * 五个锚点。type 只用 left/right，便于与 Node-RED 连线规则配对。
   */
  getDefaultAnchor() {
    const { x, y, width, height, id } = this
    const leftX = x - width / 2
    const rightX = x + width / 2
    const inset = 28
    return [
      {
        x: leftX,
        y,
        id: `${id}_left`,
        type: 'left',
        // 与其它节点左口一致：可从此向外拉线，随后由方向归一翻成「对方出→本口入」
        edgeAddable: true,
      },
      {
        x: leftX + inset,
        y,
        id: `${id}_fork`,
        type: 'right', // 作为出线端，可连到子节点 left
        edgeAddable: true,
      },
      {
        x: rightX - inset,
        y: y - height / 2 + 48,
        id: `${id}_joinOk`,
        type: 'left', // 作为入线端，子节点 right 可连入
        edgeAddable: false,
      },
      {
        x: rightX - inset,
        y: y + height / 2 - 48,
        id: `${id}_joinFail`,
        type: 'left',
        edgeAddable: false,
      },
      {
        x: rightX,
        y,
        id: `${id}_right`,
        type: 'right',
        edgeAddable: true,
      },
    ]
  }

  getConnectedSourceRules() {
    const rules = super.getConnectedSourceRules()
    rules.push({
      message: t('canvas.connection.noSelfLoop'),
      validate: (source, target) => {
        if (source && target && source.id === target.id) return false
        return true
      },
    })
    rules.push({
      message: t('forms.cgSourceAnchorOnly'),
      validate: (_s, _t, sourceAnchor) => {
        const role = cgAnchorRole(sourceAnchor?.id)
        // 左入（可反向拉后翻转）、公共并发入、右出 可作为起点
        return (
          role === CG_ANCHOR.left ||
          role === CG_ANCHOR.fork ||
          role === CG_ANCHOR.right
        )
      },
    })
    return rules
  }

  getConnectedTargetRules() {
    const rules = super.getConnectedTargetRules()
    rules.push({
      message: t('canvas.connection.noSelfLoop'),
      validate: (source, target) => {
        if (source && target && source.id === target.id) return false
        return true
      },
    })
    rules.push({
      message: t('forms.cgTargetAnchorOnly'),
      validate: (_s, _t, _sa, targetAnchor) => {
        const role = cgAnchorRole(targetAnchor?.id)
        // 仅左入 / 成功汇聚 / 失败汇聚 可作为终点
        return (
          role === CG_ANCHOR.left ||
          role === CG_ANCHOR.joinOk ||
          role === CG_ANCHOR.joinFail
        )
      },
    })
    return rules
  }

  isAllowAppendIn(nodeData: LogicFlow.NodeData) {
    const typ = nodeData?.type || ''
    if (typ === 'concurrentGroup') return false
    return true
  }
}

/**
 * 绘制组框，并在内部锚点旁标注角色名。
 */
export class ConcurrentGroupView extends DynamicGroupNode {
  getShape() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (DynamicGroupNode.prototype.getShape as any).call(this)
    const { model } = this.props
    const anchors = (model.anchors || []) as Array<
      Point & { type?: string; id?: string }
    >
    const labels: ReturnType<typeof h>[] = []
    for (const a of anchors) {
      const role = cgAnchorRole(a.id)
      let text = ''
      let fill = '#5c6bc0'
      if (role === CG_ANCHOR.left) {
        text = t('forms.cgInLabel')
        fill = '#43a047'
      } else if (role === CG_ANCHOR.right) {
        text = t('forms.cgOutLabel')
        fill = '#5c6bc0'
      } else if (role === CG_ANCHOR.fork) {
        text = t('forms.cgForkLabel')
        fill = '#5c6bc0'
      } else if (role === CG_ANCHOR.joinOk) {
        text = t('forms.cgJoinOkLabel')
        fill = '#43a047'
      } else if (role === CG_ANCHOR.joinFail) {
        text = t('forms.cgJoinFailLabel')
        fill = '#e53935'
      } else {
        continue
      }
      const isLeftSide = role === CG_ANCHOR.left || role === CG_ANCHOR.fork
      labels.push(
        h('circle', {
          cx: a.x,
          cy: a.y,
          r: 5,
          fill,
          stroke: '#fff',
          strokeWidth: 1.5,
          style: { pointerEvents: 'none' },
        }),
        h(
          'text',
          {
            x: a.x + (isLeftSide ? (role === CG_ANCHOR.left ? -10 : 10) : role === CG_ANCHOR.right ? 10 : -10),
            y: a.y - 10,
            fill,
            fontSize: 11,
            textAnchor: isLeftSide
              ? role === CG_ANCHOR.left
                ? 'end'
                : 'start'
              : role === CG_ANCHOR.right
                ? 'start'
                : 'end',
            dominantBaseline: 'auto',
            style: { userSelect: 'none', pointerEvents: 'none' },
          },
          text,
        ),
      )
    }
    return h('g', {}, [base, ...labels])
  }
}
