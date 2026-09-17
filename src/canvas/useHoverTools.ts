/**
 * 悬停驱动的浮动操作栏（节点 / 连线共用）。
 * mouseenter 显示并经 toolsExclusive 互斥 claim；mouseleave 延迟隐藏；
 * 工具条自身悬停时取消隐藏。节点与连线同一时刻只显示一个。
 */
import { onUnmounted, ref, watch, type Ref } from 'vue'
import type { LfInstance } from './lf-types'
import {
  claimCanvasTools,
  isCanvasToolsOwner,
  releaseCanvasTools,
  subscribeCanvasTools,
  type CanvasToolsKind,
} from './toolsExclusive'

export interface PlaceResult {
  x: number
  y: number
  flipDown?: boolean
}

export interface UseHoverToolsOptions {
  /** 节点或连线；用于互斥与事件绑定 */
  kind: CanvasToolsKind
  /** 目标是否仍在图中 */
  existsInGraph?: (lf: LfInstance, id: string) => boolean
  /** 离开后延迟隐藏（ms），便于移入工具条 */
  hideDelayMs?: number
}

type PlaceAtFn = (
  model: unknown,
  graphModel: unknown,
  lf: LfInstance,
) => PlaceResult | null

type GetModelFn = (lf: LfInstance, id: string) => unknown

const REPOSITION_EVENTS = [
  'graph:transform',
  'node:drag',
  'node:drop',
  'graph:rendered',
] as const

/**
 * @param options.kind 节点或连线
 * @param options.existsInGraph 校验目标仍存在
 * @param options.hideDelayMs 离开后延迟隐藏，默认 220ms
 */
export function useHoverTools(options: UseHoverToolsOptions) {
  const kind = options.kind
  const hideDelayMs = options.hideDelayMs ?? 220

  const visible = ref(false)
  const pos = ref({ x: 0, y: 0 })
  const targetId = ref<string | null>(null)
  const flipDown = ref(false)

  let placeAtFn: PlaceAtFn | null = null
  let getModelFn: GetModelFn | null = null
  let lastLf: LfInstance | null = null
  const boundHandlers: Record<string, (...args: unknown[]) => void> = {}
  let hideTimer = 0
  let overToolbar = false
  /** 当前 claim 的世代；0 表示未持有 */
  let claimGen = 0
  let unsubExclusive: (() => void) | null = null

  const setPlaceAt = (fn: PlaceAtFn) => {
    placeAtFn = fn
  }
  const setGetModel = (fn: GetModelFn) => {
    getModelFn = fn
  }

  const clearHideTimer = () => {
    if (hideTimer) {
      window.clearTimeout(hideTimer)
      hideTimer = 0
    }
  }

  /** 仅清本地 UI，不改互斥（对方 claim 时用） */
  const hideLocal = () => {
    clearHideTimer()
    overToolbar = false
    visible.value = false
    targetId.value = null
    claimGen = 0
  }

  /** 主动释放互斥并隐藏 */
  const hide = () => {
    const id = targetId.value
    const gen = claimGen
    clearHideTimer()
    overToolbar = false
    visible.value = false
    targetId.value = null
    claimGen = 0
    if (id && gen) releaseCanvasTools(kind, id, gen)
  }

  const scheduleHide = () => {
    clearHideTimer()
    hideTimer = window.setTimeout(() => {
      hideTimer = 0
      if (overToolbar) return
      hide()
    }, hideDelayMs)
  }

  /** 工具条 mouseenter：取消隐藏 */
  const onToolbarEnter = () => {
    overToolbar = true
    clearHideTimer()
  }

  /** 工具条 mouseleave：延迟隐藏 */
  const onToolbarLeave = () => {
    overToolbar = false
    scheduleHide()
  }

  /** 按当前 targetId 重新定位；目标消失或已非持有者则隐藏 */
  const reposition = () => {
    const lf = lastLf
    const id = targetId.value
    const gen = claimGen
    if (!lf || !id || !placeAtFn || !gen) {
      hide()
      return
    }
    if (!isCanvasToolsOwner(kind, id, gen)) {
      hideLocal()
      return
    }
    if (options.existsInGraph && !options.existsInGraph(lf, id)) {
      hide()
      return
    }
    const gm = lf.graphModel
    const model = getModelFn
      ? getModelFn(lf, id)
      : kind === 'node'
        ? gm?.getNodeModelById?.(id)
        : gm?.getEdgeModelById?.(id)
    if (!model) {
      hide()
      return
    }
    const p = placeAtFn(model, gm, lf)
    if (!p) {
      hide()
      return
    }
    pos.value = { x: p.x, y: p.y }
    flipDown.value = !!p.flipDown
    visible.value = true
    requestAnimationFrame(() => {
      if (!visible.value || targetId.value !== id || !lastLf) return
      if (!isCanvasToolsOwner(kind, id, claimGen)) return
      const model2 = getModelFn
        ? getModelFn(lastLf, id)
        : kind === 'node'
          ? lastLf.graphModel?.getNodeModelById?.(id)
          : lastLf.graphModel?.getEdgeModelById?.(id)
      if (!model2 || !placeAtFn) return
      const p2 = placeAtFn(model2, lastLf.graphModel, lastLf)
      if (!p2) return
      pos.value = { x: p2.x, y: p2.y }
      flipDown.value = !!p2.flipDown
    })
  }

  const showFor = (id: string) => {
    if (!id) return
    clearHideTimer()
    // 先释放旧 id（同 kind 切换目标）
    if (targetId.value && claimGen && targetId.value !== id) {
      releaseCanvasTools(kind, targetId.value, claimGen)
      claimGen = 0
    }
    targetId.value = id
    claimGen = claimCanvasTools(kind, id)
    reposition()
  }

  const onEnter = (payload: { data?: { id?: string } }) => {
    const id = payload?.data?.id
    if (!id) return
    showFor(id)
  }

  const onLeave = (payload: { data?: { id?: string } }) => {
    const id = payload?.data?.id
    if (id && targetId.value && id !== targetId.value) return
    scheduleHide()
  }

  const onDelete = (payload: { data?: { id?: string } }) => {
    const id = payload?.data?.id
    if (id && targetId.value === id) hide()
  }

  const detach = (lf: LfInstance | null) => {
    const target = lf || lastLf
    clearHideTimer()
    if (!target?.off) return
    Object.entries(boundHandlers).forEach(([name, handler]) => {
      target.off(name, handler)
      delete boundHandlers[name]
    })
  }

  const attach = (lf: LfInstance | null) => {
    detach(lastLf)
    lastLf = lf
    hide()
    if (!lf) return

    const enterEvt = kind === 'node' ? 'node:mouseenter' : 'edge:mouseenter'
    const leaveEvt = kind === 'node' ? 'node:mouseleave' : 'edge:mouseleave'
    const deleteEvt = kind === 'node' ? 'node:delete' : 'edge:delete'

    boundHandlers[enterEvt] = onEnter as (...args: unknown[]) => void
    boundHandlers[leaveEvt] = onLeave as (...args: unknown[]) => void
    boundHandlers[deleteEvt] = onDelete as (...args: unknown[]) => void
    boundHandlers['blank:click'] = () => hide()
    REPOSITION_EVENTS.forEach((evt) => {
      boundHandlers[evt] = () => {
        if (visible.value || targetId.value) reposition()
      }
    })

    Object.entries(boundHandlers).forEach(([name, handler]) => {
      lf.on(name, handler)
    })
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

  unsubExclusive = subscribeCanvasTools((o) => {
    // 被对方抢占：只清本地，不 release（持有者已是对方）
    if (!claimGen || !targetId.value) return
    if (o && o.kind === kind && o.id === targetId.value && o.gen === claimGen) {
      return
    }
    hideLocal()
  })

  onUnmounted(() => {
    unsubExclusive?.()
    unsubExclusive = null
    hide()
    detach(lastLf)
  })

  return {
    visible,
    pos,
    targetId,
    flipDown,
    hide,
    showFor,
    reposition,
    onToolbarEnter,
    onToolbarLeave,
    setPlaceAt,
    setGetModel,
    watchLf,
    attach,
    detach,
  }
}

/** 便捷：从 Ref 监听 lf */
export function watchHoverLfRef(
  tools: ReturnType<typeof useHoverTools>,
  lfRef: Ref<LfInstance | null>,
) {
  return tools.watchLf(() => lfRef.value)
}
