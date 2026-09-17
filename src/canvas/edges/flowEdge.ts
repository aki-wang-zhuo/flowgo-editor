/**
 * FlowGo 贝塞尔连线：选中变色；路径标签白底 + 同色描边（盖住下方连线）。
 * 悬停路径不高亮；仅悬停中间文字块时标签变色，并供操作栏绑定。
 * 拖入插入时 insertHighlight 高亮。
 */
import { BezierEdge, BezierEdgeModel } from '@logicflow/core'
import { cubicBezierPoint, INSERT_HIGHLIGHT_KEY, type BezierPoint } from '../bezier'
import './flowEdge.css'

const COLOR_NORMAL = '#999'
const COLOR_HOVER = '#5b9bd5'
const COLOR_SELECTED = '#ff7f0e'
const COLOR_INSERT = '#409eff'

/**
 * 白底填充（盖住下方连线），不能用 transparent：
 * LogicFlow LineText 在 fill==='transparent' 时不绘制背景框。
 */
const FILL_BADGE = '#ffffff'

/** 当前边应使用的描边色（路径忽略 hover，仅选中 / 插入高亮） */
function edgeStrokeColor(model: {
  isSelected?: boolean
  properties?: Record<string, unknown>
}): string {
  if (model.properties?.[INSERT_HIGHLIGHT_KEY]) return COLOR_INSERT
  if (model.isSelected) return COLOR_SELECTED
  return COLOR_NORMAL
}

/** 路径标签：白底 + 同色描边，盖住下方连线 */
function badgeBackground(stroke: string) {
  return {
    fill: FILL_BADGE,
    stroke,
    strokeWidth: 1.5,
    radius: 3,
    // 上小下大：抵消 LineText 背景框固定的 y-1
    wrapPadding: '2px,8px,4px,8px',
  }
}

class FlowEdgeModel extends BezierEdgeModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initEdgeData(data: any) {
    super.initEdgeData(data)
    // 标签始终跟曲线中点（getTextPosition）；打开后节点移动时 LF 只 reset，
    // 不再叠加 handleEdgeTextMove 的二次平移（否则自动布局大位移会错位）
    this.customTextPosition = true
    // 禁止边文本编辑/拖拽，避免进入文本编辑态与文本光标
    if (this.text) {
      this.text.editable = false
      this.text.draggable = false
    }
  }

  /**
   * 标签放在曲线中点（t=0.5），保证调节控制点后仍贴在路径上。
   */
  getTextPosition(): BezierPoint {
    const pts = this.pointsList as BezierPoint[] | undefined
    if (pts && pts.length >= 4) {
      return cubicBezierPoint(pts[0], pts[1], pts[2], pts[3], 0.5)
    }
    if (pts && pts.length >= 2) {
      const a = pts[0]
      const b = pts[pts.length - 1]
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
    return super.getTextPosition()
  }

  /**
   * 端点随节点移动时同步刷新标签位置（父类只改 path，不改 text）。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatePath(sNext: any, ePre: any) {
    super.updatePath(sNext, ePre)
    if (this.text?.value) {
      this.resetTextPosition()
    }
  }

  getEdgeStyle() {
    const style = super.getEdgeStyle()
    const stroke = edgeStrokeColor(this)
    const inserting = !!this.properties?.[INSERT_HIGHLIGHT_KEY]
    style.stroke = stroke
    // 路径悬停不加粗；仅选中 / 插入高亮加粗
    style.strokeWidth = inserting || this.isSelected ? 3 : 2
    style.cursor = 'pointer'
    return style
  }

  getTextStyle() {
    const style = super.getTextStyle()
    const stroke = edgeStrokeColor(this)
    style.color = stroke
    style.fontSize = 11
    style.cursor = 'pointer'
    style.background = badgeBackground(stroke)
    // 文字块自身悬停色（LineText 本地 isHovered）；路径悬停不会驱动到此
    style.hover = {
      textWidth: style.textWidth ?? 100,
      fontSize: style.fontSize ?? 11,
      color: this.properties?.[INSERT_HIGHLIGHT_KEY]
        ? COLOR_INSERT
        : this.isSelected
          ? COLOR_SELECTED
          : COLOR_HOVER,
      cursor: 'pointer',
      background: badgeBackground(
        this.properties?.[INSERT_HIGHLIGHT_KEY]
          ? COLOR_INSERT
          : this.isSelected
            ? COLOR_SELECTED
            : COLOR_HOVER,
      ),
    }
    return style
  }

  /** 禁用选中外框（再保险；全局已关 edgeSelectedOutline） */
  getOutlineStyle() {
    const style = super.getOutlineStyle?.() || { hover: {} }
    style.stroke = 'transparent'
    if (!style.hover) style.hover = {}
    style.hover.stroke = 'transparent'
    return style
  }
}

/**
 * 视图：仅在指向中间文字块时进入 hover；给文字块打上 data-edge-id 供操作栏绑定。
 */
class FlowEdgeView extends BezierEdge {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(props?: any) {
    super(props)
    // 覆盖父类：悬停路径不再 setHovered / 不再同步文字 hover
    this.setHoverOn = (ev: MouseEvent) => {
      const t = ev?.target as Element | null
      if (!t?.closest?.('.lf-line-text')) return
      if (this.props.model.isHovered) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textComp = this.textRef?.current as { setHoverOn?: () => void } | null
      textComp?.setHoverOn?.()
      this.handleHover(true, ev)
    }
    this.setHoverOff = (ev: MouseEvent) => {
      if (!this.props.model.isHovered) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textComp = this.textRef?.current as { setHoverOff?: () => void } | null
      textComp?.setHoverOff?.()
      this.handleHover(false, ev)
    }
  }

  /** 在文字块 DOM 上写入边 id，供悬停操作栏识别 */
  private stampTextEdgeId() {
    const id = this.props?.model?.id
    if (!id) return
    // Preact 组件根节点
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const root = (this as any).base as Element | undefined
    const textEl = root?.querySelector?.('.lf-line-text')
    if (textEl instanceof Element) {
      textEl.setAttribute('data-edge-id', String(id))
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentDidMount(...args: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(BezierEdge.prototype as any).componentDidMount?.apply(this, args)
    this.stampTextEdgeId()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentDidUpdate(...args: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(BezierEdge.prototype as any).componentDidUpdate?.apply(this, args)
    this.stampTextEdgeId()
  }
}

/** 注册到 LogicFlow 的边类型定义 */
export const flowEdge = {
  type: 'bezier',
  view: FlowEdgeView,
  model: FlowEdgeModel,
}
