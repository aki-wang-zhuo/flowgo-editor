/**
 * 画布小地图工具：基于 @logicflow/extension MiniMap。
 * 须在插件 render 把 container 挂好后再 show；禁止对未挂载节点 hide。
 */
import type { LfInstance } from './lf-types'

/** 小地图相对画布右下角的边距（px） */
export const MINIMAP_POSITION = { right: 12, bottom: 12 } as const

/** MiniMap 插件实例（官方类型多为 private，运行时可访问） */
export interface MiniMapApi {
  isShow?: boolean
  container?: HTMLElement | null
  miniMapContainer?: HTMLElement | null
  show?: (left?: number, top?: number) => void
  hide?: () => void
  updatePosition?: (pos: {
    right?: number
    bottom?: number
    left?: number
    top?: number
  }) => void
  /** 内部方法：刷新缩略内容；存在则优先于 hide/show */
  setView?: (reRender?: boolean) => void
  headerTitle?: string
  isShowCloseIcon?: boolean
  isShowHeader?: boolean
}

/** 取当前 LogicFlow 上的 MiniMap 扩展 */
export function getMiniMap(lf: LfInstance | null | undefined): MiniMapApi | null {
  const mm = lf?.extension?.miniMap as MiniMapApi | undefined
  return mm?.show ? mm : null
}

/** 插件 render 是否已写入挂载容器 */
export function isMiniMapReady(mm: MiniMapApi | null): boolean {
  return !!mm?.container
}

/**
 * 安全隐藏：仅当 DOM 上确有子节点时走官方 hide，避免 removeChild 抛错。
 */
export function hideMiniMap(lf: LfInstance | null | undefined) {
  const mm = getMiniMap(lf)
  if (!mm?.isShow) return
  const el = mm.miniMapContainer
  const host = mm.container
  if (el && host && el.parentNode === host) {
    mm.hide?.()
    return
  }
  // 未挂上或已游离：只复位状态，不碰 DOM
  mm.isShow = false
  mm.miniMapContainer = undefined
}

/**
 * 显示小地图并固定到右下角。
 * @param title 标题栏文案（关闭按钮旁）
 */
export function showMiniMap(
  lf: LfInstance | null | undefined,
  title?: string,
) {
  const mm = getMiniMap(lf)
  if (!mm || !isMiniMapReady(mm)) return false
  if (title != null) mm.headerTitle = title
  if (mm.isShow) {
    // 已显示：只刷新图与位置，避免 hide/show 拆 DOM
    mm.setView?.(true)
    mm.updatePosition?.(MINIMAP_POSITION)
    return true
  }
  mm.show?.()
  // show 后可能重建 header，再写一次标题
  if (title != null && mm.miniMapContainer) {
    const header = mm.miniMapContainer.querySelector('.lf-mini-map-header')
    if (header) header.textContent = title
  }
  mm.updatePosition?.(MINIMAP_POSITION)
  return true
}

/**
 * 在插件就绪后显示；未就绪则短延迟重试（等 ToolOverlay 执行 extension.render）。
 */
export function showMiniMapWhenReady(
  lf: LfInstance | null | undefined,
  title?: string,
  retries = 12,
): void {
  if (!lf) return
  if (showMiniMap(lf, title)) return
  if (retries <= 0) return
  requestAnimationFrame(() => {
    showMiniMapWhenReady(lf, title, retries - 1)
  })
}
