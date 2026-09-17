/**
 * 抑制「画布外按下、画布上松开」触发的伪空白点击。
 * LogicFlow 在 canvas-overlay 的 pointerup 里会 clearSelectElements 并派发 blank:click；
 * 在属性面板等区域拖选文本后移出松开时，会误清选中导致右侧属性消失。
 *
 * 例外：左侧组件库拖入画布（palette DnD）必须把 pointerup 交给 LogicFlow，否则无法落点。
 */

/** 面板拖入进行中时挂在 documentElement 上的标记 */
export const PALETTE_DND_ATTR = 'data-fg-palette-dnd'

/** 标记「正在从组件库拖入节点」 */
export function markPaletteDndActive() {
  document.documentElement.setAttribute(PALETTE_DND_ATTR, '1')
}

/** 清除面板拖入标记（下一帧，避免抢在 LogicFlow 处理 pointerup 之前） */
export function clearPaletteDndActive() {
  requestAnimationFrame(() => {
    document.documentElement.removeAttribute(PALETTE_DND_ATTR)
  })
}

function isPaletteDndActive(): boolean {
  return document.documentElement.hasAttribute(PALETTE_DND_ATTR)
}

/**
 * 绑定伪空白点击抑制。
 * @returns 卸载函数
 */
export function bindSuppressSpuriousBlankClick(
  canvasEl: HTMLElement | null | undefined,
): () => void {
  if (!canvasEl) return () => undefined

  /** 本次指针按下是否发生在画布容器内 */
  let downInsideCanvas = false

  const onPointerDown = (e: PointerEvent) => {
    const t = e.target
    downInsideCanvas = !!(t instanceof Node && canvasEl.contains(t))
  }

  /**
   * 在捕获阶段拦住送到画布的 pointerup：
   * 按下在画布外、松开在画布上 → 不让 LogicFlow CanvasOverlay 收到事件。
   * 面板 DnD 例外：放行，保证拖放可放置。
   */
  const onPointerUpCapture = (e: PointerEvent) => {
    if (downInsideCanvas) return
    if (isPaletteDndActive()) return
    const t = e.target
    if (!(t instanceof Node) || !canvasEl.contains(t)) return
    e.stopPropagation()
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  canvasEl.addEventListener('pointerup', onPointerUpCapture, true)
  canvasEl.addEventListener('pointercancel', onPointerUpCapture, true)

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    canvasEl.removeEventListener('pointerup', onPointerUpCapture, true)
    canvasEl.removeEventListener('pointercancel', onPointerUpCapture, true)
  }
}
