/**
 * 悬停驱动的浮动操作栏（节点 / 连线共用）。
 * mouseenter 显示并经 toolsExclusive 互斥 claim；mouseleave 延迟隐藏；
 * 工具条自身悬停时取消隐藏。节点与连线同一时刻只显示一个。
 *
 * 连线仅绑定中间文字块；快速划过两条线或选中后 DOM 重绘时，用世代号 +
 * elementFromPoint 避免旧 hide 定时器误清、或丢悬停后不再显示。
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
  /** 最近指针位置，供延迟隐藏时探测是否仍在目标上 */
  let lastPointer = { x: 0, y: 0 }

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

  /**
   * 延迟隐藏：捕获调度时的 id/gen，超时后若已切到其它目标则忽略，
   * 避免快速 A→B 时 A 的定时器把 B 清掉。
   */
  const scheduleHide = (forId?: string | null) => {
    clearHideTimer()
    const idAtSchedule = forId ?? targetId.value
    const genAtSchedule = claimGen
    if (!idAtSchedule || !genAtSchedule) return
    hideTimer = window.setTimeout(() => {
      hideTimer = 0
      if (overToolbar) return
      // 已切到别的目标 / 新世代：本轮 hide 作废
      if (targetId.value !== idAtSchedule || claimGen !== genAtSchedule) return

      // 指针仍在连线文字块上（含 DOM 重绘后的新节点）：重新 show，勿藏
      if (kind === 'edge') {
        const under = document.elementFromPoint(lastPointer.x, lastPointer.y)
        const text = under?.closest?.('.lf-line-text') as Element | null
        const stillId = text?.getAttribute?.('data-edge-id')
        if (stillId) {
          showFor(stillId)
          return
        }
      }
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
    // 同一目标已显示：只取消隐藏并校正位置，避免反复 claim 打乱世代
    if (targetId.value === id && claimGen && visible.value) {
      if (isCanvasToolsOwner(kind, id, claimGen)) {
        reposition()
        return
      }
    }
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
    scheduleHide(id || targetId.value)
  }

  const onDelete = (payload: { data?: { id?: string } }) => {
    const id = payload?.data?.id
    if (id && targetId.value === id) hide()
  }

  /** 连线：仅绑定路径中间文字块（.lf-line-text），不绑整条执行线 */
  let edgeTextDomCleanups: Array<() => void> = []

  const detachEdgeTextDom = () => {
    edgeTextDomCleanups.forEach((fn) => fn())
    edgeTextDomCleanups = []
  }

  const trackPointer = (e: MouseEvent) => {
    lastPointer = { x: e.clientX, y: e.clientY }
  }

  const attachEdgeTextDom = (lf: LfInstance) => {
    detachEdgeTextDom()
    const container = lf.container as HTMLElement | undefined | null
    if (!container) return

    const onOver = (e: MouseEvent) => {
      trackPointer(e)
      const text = (e.target as Element | null)?.closest?.('.lf-line-text')
      if (!text) return
      const fromText = (e.relatedTarget as Element | null)?.closest?.(
        '.lf-line-text',
      )
      // 仍在同一文字块内移动：忽略；跨到另一条线的文字块要切换
      if (fromText === text) return
      const id = text.getAttribute('data-edge-id')
      if (id) showFor(id)
    }
    const onOut = (e: MouseEvent) => {
      trackPointer(e)
      const text = (e.target as Element | null)?.closest?.('.lf-line-text')
      if (!text) return
      const to = e.relatedTarget as Element | null
      if (to && text.contains(to)) return
      // 直接划入另一条线的文字块：由对方 mouseover 接手，勿调度 hide
      if (to?.closest?.('.lf-line-text')) return
      const id = text.getAttribute('data-edge-id')
      if (id && targetId.value && id !== targetId.value) return
      scheduleHide(id)
    }

    container.addEventListener('mouseover', onOver)
    container.addEventListener('mouseout', onOut)
    container.addEventListener('pointermove', trackPointer, { passive: true })
    edgeTextDomCleanups.push(() => {
      container.removeEventListener('mouseover', onOver)
      container.removeEventListener('mouseout', onOut)
      container.removeEventListener('pointermove', trackPointer)
    })
  }

  const detach = (lf: LfInstance | null) => {
    const target = lf || lastLf
    clearHideTimer()
    detachEdgeTextDom()
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

    if (kind === 'node') {
      boundHandlers['node:mouseenter'] = onEnter as (...args: unknown[]) => void
      boundHandlers['node:mouseleave'] = onLeave as (...args: unknown[]) => void
      boundHandlers['node:delete'] = onDelete as (...args: unknown[]) => void
    } else {
      // 连线菜单只响应文字块 DOM 悬停，不监听 edge:mouseenter（整条线）
      attachEdgeTextDom(lf)
      boundHandlers['edge:delete'] = onDelete as (...args: unknown[]) => void
      // 选中/重绘后文字块 DOM 可能重建，用 pointer 探测补回悬停
      boundHandlers['edge:click'] = ((payload: {
        data?: { id?: string }
        e?: MouseEvent
      }) => {
        const ev = payload?.e
        if (ev) trackPointer(ev)
        // 下一帧再探测：等选中样式导致的 DOM 更新完成
        requestAnimationFrame(() => {
          const under = document.elementFromPoint(lastPointer.x, lastPointer.y)
          const text = under?.closest?.('.lf-line-text') as Element | null
          const id = text?.getAttribute?.('data-edge-id')
          if (id) showFor(id)
        })
      }) as (...args: unknown[]) => void
    }
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
