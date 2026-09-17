/**
 * Node-RED 风格节点：矮圆角矩形 + 左侧图标区 + 左右端口。
 * 视觉参考 Node-RED / rulego-editor BaseNode，独立实现不依赖 rulego。
 */
import { h, RectNode, RectNodeModel } from '@logicflow/core'
import { t } from '@/i18n'

const ICON_W = 30
const FONT_SIZE = 12
const MIN_W = 100
const MAX_W = 320
const HEIGHT = 30
const RADIUS = 5

/** Node-RED function 节点常见底色 */
const FILL_JS = '#fdd0a2'
const STROKE = '#999'
const STROKE_SELECTED = '#ff7f0e'
const STROKE_ENTRY = '#ad7a20'
/** 测试运行失败节点描边 */
const STROKE_RUN_ERROR = '#dc2626'

function estimateTextWidth(text: string): number {
  if (!text) return 0
  let w = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code > 0xff) w += FONT_SIZE
    else if (code >= 0x41 && code <= 0x5a) w += FONT_SIZE * 0.65
    else w += FONT_SIZE * 0.55
  }
  return w
}

/**
 * 节点模型：尺寸与锚点。
 */
export class NodeRedModel extends RectNodeModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initNodeData(data: any) {
    super.initNodeData(data)
    this.width = MIN_W
    this.height = HEIGHT
    this.radius = RADIUS
    this.resizable = false
    this.text.editable = false
    // 文字中心偏右，避开左侧图标区（与 Node-RED / rulego 一致）
    this.text.x = this.x + ICON_W / 2
    this.setAttributes()
  }

  setAttributes() {
    const prevW = this.width
    const label =
      (this.properties?.name as string) || this.text?.value || this.type || ''
    const textW = estimateTextWidth(label)
    let width = ICON_W + textW + 16
    width = Math.max(MIN_W, Math.min(MAX_W, width))
    this.width = width
    this.height = HEIGHT
    this.text.x = this.x + ICON_W / 2
    this.text.y = this.y
    // 宽度变化后左右锚点位移，需同步刷新入边/出边端点，避免线被节点盖住或悬空
    if (prevW !== width) {
      this.refreshConnectedEdgeAnchors()
    }
  }

  updateText(val: string) {
    super.updateText(val)
    this.setAttributes()
  }

  /**
   * 按当前 anchors 重绑所有相连边的起终点（改名导致变宽时调用）。
   */
  refreshConnectedEdgeAnchors() {
    const gm = this.graphModel as
      | {
          getNodeEdges?: (id: string) => Array<{
            sourceNodeId?: string
            targetNodeId?: string
            sourceAnchorId?: string
            targetAnchorId?: string
            updateStartPoint?: (p: { x: number; y: number }) => void
            updateEndPoint?: (p: { x: number; y: number }) => void
          }>
        }
      | undefined
    if (!gm?.getNodeEdges) return
    const edges = gm.getNodeEdges(this.id) || []
    if (!edges.length) return
    for (const edge of edges) {
      if (edge.sourceNodeId === this.id && edge.updateStartPoint) {
        const a =
          this.getAnchorInfo(edge.sourceAnchorId) ||
          this.anchors.find((x: { type?: string }) => x.type === 'right') ||
          this.anchors[this.anchors.length - 1]
        if (a) edge.updateStartPoint({ x: a.x, y: a.y })
      }
      if (edge.targetNodeId === this.id && edge.updateEndPoint) {
        const a =
          this.getAnchorInfo(edge.targetAnchorId) ||
          this.anchors.find((x: { type?: string }) => x.type === 'left') ||
          this.anchors[0]
        if (a) edge.updateEndPoint({ x: a.x, y: a.y })
      }
    }
  }

  getNodeStyle() {
    const style = super.getNodeStyle()
    const isEntry = !!this.properties?.isEntry
    const runError = !!this.properties?.runError
    const fill = (this.properties?.color as string) || FILL_JS
    style.fill = fill
    if (runError) {
      style.stroke = STROKE_RUN_ERROR
      style.strokeWidth = 2.5
    } else {
      style.stroke = this.isSelected
        ? STROKE_SELECTED
        : isEntry
          ? STROKE_ENTRY
          : STROKE
      style.strokeWidth = this.isSelected || isEntry ? 2 : 1
    }
    return style
  }

  getTextStyle() {
    const style = super.getTextStyle()
    style.fontSize = FONT_SIZE
    style.color = '#333'
    style.overflowMode = 'default'
    return style
  }

  /** 左右端口：左=入、右=出；可从左侧拉线到对方右侧，随后翻转为出→入 */
  getDefaultAnchor() {
    const { x, y, id, width } = this
    return [
      {
        x: x - width / 2,
        y,
        id: `${id}_left`,
        type: 'left',
      },
      {
        x: x + width / 2,
        y,
        id: `${id}_right`,
        type: 'right',
      },
    ]
  }

  /**
   * 作为连线起点：允许 右→左（正向）或 左→右（随后翻转）；禁止连到自身。
   */
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
      message: t('canvas.connection.ioOnly'),
      validate: (_source, _target, sourceAnchor, targetAnchor) => {
        if (!sourceAnchor?.type || !targetAnchor?.type) return true
        const s = sourceAnchor.type
        const t = targetAnchor.type
        if (s === 'right' && t === 'left') return true
        if (s === 'left' && t === 'right') return true
        return false
      },
    })
    return rules
  }

  /**
   * 作为连线终点：同上，仅允许出↔入配对；禁止自身回环。
   */
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
      message: t('canvas.connection.ioOnly'),
      validate: (_source, _target, sourceAnchor, targetAnchor) => {
        if (!sourceAnchor?.type || !targetAnchor?.type) return true
        const s = sourceAnchor.type
        const t = targetAnchor.type
        if (s === 'right' && t === 'left') return true
        if (s === 'left' && t === 'right') return true
        return false
      },
    })
    return rules
  }

  getOutlineStyle() {
    const style = super.getOutlineStyle() || { hover: {} }
    style.stroke = 'transparent'
    if (!style.hover) style.hover = {}
    style.hover.stroke = 'transparent'
    return style
  }
}

/**
 * 节点视图：主体 + 左侧图标条 + 分隔线 + 简易 function 图标。
 */
export class NodeRedView extends RectNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAnchorShape(anchorData: any) {
    const { x, y } = anchorData
    return h('rect', {
      x: x - 4,
      y: y - 4,
      width: 8,
      height: 8,
      className: 'fg-nr-anchor',
      rx: 1,
      ry: 1,
    })
  }

  getShape() {
    const { x, y, width, height, radius, id } = this.props.model
    const style = this.props.model.getNodeStyle()
    const isEntry = !!this.props.model.properties?.isEntry
    const left = x - width / 2
    const top = y - height / 2
    // SVG 的 <g> 不支持 overflow:hidden；用父级 clipPath 等效「圆角容器裁剪子层」
    const clipId = `fg-nr-clip-${id}`
    return h(
      'g',
      {
        className: 'fg-nr-node',
        'clip-path': `url(#${clipId})`,
      },
      [
        h('defs', {}, [
          h(
            'clipPath',
            { id: clipId },
            h('rect', {
              x: left,
              y: top,
              width,
              height,
              rx: radius,
              ry: radius,
            }),
          ),
        ]),
        h('rect', {
          ...style,
          x: left,
          y: top,
          width,
          height,
          rx: radius,
          ry: radius,
        }),
        // 左侧图标区：放在被裁剪的父组内，直角底衬不会溢出圆角
        h(
          'g',
          {
            style: 'pointer-events: none;',
            transform: `translate(${x}, ${y})`,
          },
          [
            h('rect', {
              x: -width / 2,
              y: -height / 2,
              width: ICON_W,
              height,
              fill: '#000',
              fillOpacity: 0.06,
              stroke: 'none',
            }),
            h('path', {
              d: `M ${ICON_W - width / 2} ${1 - height / 2} l 0 ${height - 2}`,
              stroke: '#000',
              strokeOpacity: 0.12,
              strokeWidth: 1,
            }),
            h(
              'text',
              {
                x: -width / 2 + ICON_W / 2,
                y: 1,
                textAnchor: 'middle',
                dominantBaseline: 'middle',
                fill: '#666',
                fontSize: 14,
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontStyle: 'italic',
              },
              (this.props.model.properties?.iconText as string) || 'ƒ',
            ),
            ...(isEntry
              ? [
                  h('circle', {
                    cx: -width / 2 + 6,
                    cy: height / 2 - 6,
                    r: 3,
                    fill: STROKE_ENTRY,
                    stroke: 'none',
                  }),
                ]
              : []),
          ],
        ),
      ],
    )
  }
}
