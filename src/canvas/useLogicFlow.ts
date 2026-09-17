/**
 * LogicFlow 实例创建与销毁封装。
 */
import { onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import LogicFlow from '@logicflow/core'
import { MiniMap, SelectionSelect, Snapshot } from '@logicflow/extension'
import '@logicflow/core/lib/style/index.css'
import '@logicflow/extension/lib/style/index.css'
import { registerFlowNodes } from './registerNodes'
import { cachedComponentTypes } from './componentCatalog'
import type { LfInstance } from './lf-types'

/** 画布缩放下限（0.05 = 5%） */
const ZOOM_MIN = 0.05
/** 画布缩放上限（2.5 = 250%） */
const ZOOM_MAX = 2.5
/**
 * 滚轮缩放绝对步长（与当前比例无关）。
 * LogicFlow 默认按 ±ZOOM_SIZE 加减；此前体感「放大时步长变小」是相对变化造成的错觉。
 */
const ZOOM_STEP = 0.1

export interface UseLogicFlowOptions {
  /** 网格大小 */
  gridSize?: number
}

/**
 * 配置缩放范围，并保证滚轮使用恒定绝对步长（不受当前缩放影响）。
 */
function configureCanvasZoom(instance: LfInstance) {
  instance.setZoomMiniSize?.(ZOOM_MIN)
  instance.setZoomMaxSize?.(ZOOM_MAX)
  const tm = instance.graphModel?.transformModel
  if (!tm) return
  tm.MINI_SCALE_SIZE = ZOOM_MIN
  tm.MAX_SCALE_SIZE = ZOOM_MAX
  tm.ZOOM_SIZE = ZOOM_STEP

  // 覆盖 boolean 滚轮缩放：始终 ±ZOOM_STEP，再钳制到 [min, max]
  const zoomOrig = tm.zoom.bind(tm)
  tm.zoom = (zoomSize?: boolean | number, point?: [number, number]) => {
    if (typeof zoomSize === 'number') {
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomSize))
      return zoomOrig(clamped, point)
    }
    const cur = tm.SCALE_X as number
    const next =
      zoomSize === true ? cur + ZOOM_STEP : cur - ZOOM_STEP
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    if (clamped === cur) {
      return `${(cur * 100).toFixed(0)}%`
    }
    return zoomOrig(clamped, point)
  }
}

/**
 * 在指定容器上初始化 LogicFlow，组件卸载时自动销毁。
 * 注册官方 SelectionSelect；默认关闭，由 Alt 键临时开启框选。
 * 画布创建不阻塞组件目录请求；已缓存的 type 会立刻注册，否则用 jsTransform 兜底。
 */
export function useLogicFlow(
  container: Ref<HTMLElement | null>,
  options: UseLogicFlowOptions = {},
) {
  const lf = shallowRef<LfInstance | null>(null)
  const ready = ref(false)

  function init() {
    if (!container.value || lf.value) return
    const instance = new LogicFlow({
      container: container.value,
      grid: {
        size: options.gridSize ?? 20,
        visible: true,
        type: 'dot',
      },
      keyboard: { enabled: true },
      edgeTextEdit: false,
      nodeTextEdit: false,
      adjustEdge: false, // 默认不显示连线调节手柄，双击连线后再开启
      edgeSelectedOutline: false, // 选中连线不显示外框，改由边样式变色
      hoverOutline: true,
      // 滚轮默认缩放画布（true = 禁止滚轮平移，改为缩放）
      stopScrollGraph: true,
      // 允许多选（框选结果可同时高亮多个节点）
      multipleSelectKey: 'ctrl',
      plugins: [SelectionSelect, MiniMap, Snapshot],
      pluginsOptions: {
        // 右下角缩略图；关闭改走右键菜单（见 CanvasMiniMap）
        miniMap: {
          width: 180,
          height: 120,
          showEdge: true,
          isShowHeader: false,
          isShowCloseIcon: false,
          rightPosition: 12,
          bottomPosition: 12,
        },
      },
    })
    registerFlowNodes(instance, cachedComponentTypes())
    // 默认关框选，空白拖拽用于平移画布
    instance.closeSelectionSelect?.()
    instance.updateEditConfig?.({
      stopMoveGraph: false,
      stopScrollGraph: true,
    })
    configureCanvasZoom(instance)
    lf.value = instance
    ready.value = true
  }

  function destroy() {
    if (lf.value) {
      container.value && (container.value.innerHTML = '')
      lf.value = null
      ready.value = false
    }
  }

  onBeforeUnmount(destroy)

  return { lf, ready, init, destroy }
}
