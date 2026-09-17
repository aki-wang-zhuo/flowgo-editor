/**
 * 选中态驱动的浮动操作栏定位骨架（对齐 rulego-editor useSelectionTools）。
 * 调用方注入 decide / placeAt / getModel。
 */
import { onUnmounted, ref, watch, type Ref } from 'vue'
import type { LfInstance } from './lf-types'

export interface SelectionDecision {
  targetId: string
}

export interface PlaceResult {
  x: number
  y: number
  flipDown?: boolean
}

export interface UseSelectionToolsOptions {
  /** 目标是否仍在图中 */
  existsInGraph?: (lf: LfInstance, id: string) => boolean
}

type DecideFn = (sel: {
  nodes: Array<{ id: string; type?: string }>
  edges: Array<{ id: string }>
}) => SelectionDecision | null

type PlaceAtFn = (
  model: unknown,
  graphModel: unknown,
  lf: LfInstance,
) => PlaceResult | null

type GetModelFn = (lf: LfInstance, id: string) => unknown

const SYNC_EVENTS = [
  'node:click',
  'edge:click',
  'blank:click',
  'selection:selected',
  'selection:drop',
  'node:add',
  'node:delete',
  'edge:add',
  'edge:delete',
  'node:drag',
  'graph:rendered',
] as const

/**
 * 这些事件在 LF 内部是「先 emit、后 select*ById」。
 * 同步读选中集必须延后到当前调用栈结束，否则首次点击读到旧选中、菜单不出现。
 */
const DEFER_SYNC_EVENTS = new Set([
  'node:click',
  'edge:click',
  'blank:click',
])

const TRANSFORM_EVENT = 'graph:transform'

/**
 * @param options.existsInGraph 校验目标仍存在
 */
export function useSelectionTools(options: UseSelectionToolsOptions = {}) {
  const visible = ref(false)
  const pos = ref({ x: 0, y: 0 })
  const targetId = ref<string | null>(null)
  const flipDown = ref(false)

  let decideFn: DecideFn | null = null
  let placeAtFn: PlaceAtFn | null = null
  let getModelFn: GetModelFn | null = null
  let lastLf: LfInstance | null = null
  const boundHandlers: Record<string, () => void> = {}
  let rafId = 0

  const setDecide = (fn: DecideFn) => {
    decideFn = fn
  }
  const setPlaceAt = (fn: PlaceAtFn) => {
    placeAtFn = fn
  }
  const setGetModel = (fn: GetModelFn) => {
    getModelFn = fn
  }

  const hide = () => {
    visible.value = false
    targetId.value = null
  }

  const syncFromSelection = () => {
    const lf = lastLf
    if (!lf || !decideFn) {
      hide()
      return
    }
    const sel = lf.getSelectElements?.() || {}
    const decision = decideFn({
      nodes: sel.nodes || [],
      edges: sel.edges || [],
    })
    if (!decision?.targetId) {
      hide()
      return
    }
    const id = decision.targetId
    if (options.existsInGraph && !options.existsInGraph(lf, id)) {
      hide()
      return
    }
    const gm = lf.graphModel
    const model = getModelFn
      ? getModelFn(lf, id)
      : gm?.getNodeModelById?.(id)
    if (!model || !placeAtFn) {
      hide()
      return
    }
    const p = placeAtFn(model, gm, lf)
    if (!p) {
      hide()
      return
    }
    targetId.value = id
    pos.value = { x: p.x, y: p.y }
    flipDown.value = !!p.flipDown
    visible.value = true
    // 首次挂载后实测尺寸再校正一次位置（v-if 初次无 DOM）
    requestAnimationFrame(() => {
      if (!visible.value || targetId.value !== id || !lastLf) return
      const model2 = getModelFn
        ? getModelFn(lastLf, id)
        : lastLf.graphModel?.getNodeModelById?.(id)
      if (!model2 || !placeAtFn) return
      const p2 = placeAtFn(model2, lastLf.graphModel, lastLf)
      if (!p2) return
      pos.value = { x: p2.x, y: p2.y }
      flipDown.value = !!p2.flipDown
    })
  }

  /** 帧后再同步，避开 LF「先事件后选中」的时序 */
  const syncDeferred = () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      rafId = 0
      syncFromSelection()
    })
  }

  const detach = (lf: LfInstance | null) => {
    const target = lf || lastLf
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    if (!target?.off) return
    Object.entries(boundHandlers).forEach(([name, handler]) => {
      target.off(name, handler)
      delete boundHandlers[name]
    })
  }

  const attach = (lf: LfInstance | null) => {
    detach(lastLf)
    lastLf = lf
    if (!lf) return
    const syncImmediate = () => syncFromSelection()
    boundHandlers[TRANSFORM_EVENT] = syncImmediate
    SYNC_EVENTS.forEach((evt) => {
      boundHandlers[evt] = DEFER_SYNC_EVENTS.has(evt)
        ? syncDeferred
        : syncImmediate
    })
    Object.entries(boundHandlers).forEach(([name, handler]) => {
      lf.on(name, handler)
    })
    syncFromSelection()
  }

  /**
   * 监听 lf 引用变化并绑定事件。
   */
  const watchLf = (getLf: () => LfInstance | null | undefined) =>
    watch(
      getLf,
      (nv, ov) => {
        detach(ov || null)
        hide()
        attach(nv || null)
      },
      { immediate: true },
    )

  onUnmounted(() => {
    detach(lastLf)
  })

  return {
    visible,
    pos,
    targetId,
    flipDown,
    hide,
    syncFromSelection,
    setDecide,
    setPlaceAt,
    setGetModel,
    watchLf,
    attach,
    detach,
  }
}

/** 便捷：从 Ref 监听 lf */
export function watchLfRef(
  tools: ReturnType<typeof useSelectionTools>,
  lfRef: Ref<LfInstance | null>,
) {
  return tools.watchLf(() => lfRef.value)
}
