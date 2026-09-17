/**
 * Alt + 左键拖拽框选：按住 Alt 临时开启 SelectionSelect，松开恢复画布平移。
 * 使用 @logicflow/extension 官方 SelectionSelect API。
 */
import { onBeforeUnmount, watch, type Ref } from 'vue'
import type { LfInstance } from './lf-types'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return !!el.closest?.('[contenteditable="true"]')
}

/**
 * 绑定 Alt 键与框选开关。
 * @returns 清理函数（也可依赖 onBeforeUnmount）
 */
export function useAltSelectionSelect(lfRef: Ref<LfInstance | null>) {
  let altHeld = false

  const forceAllowPan = (lf: LfInstance) => {
    if (!lf?.updateEditConfig) return
    if (lf.getEditConfig?.()?.stopMoveGraph) {
      lf.updateEditConfig({ stopMoveGraph: false })
    }
  }

  const openSelect = (lf: LfInstance) => {
    if (!lf?.openSelectionSelect) return
    lf.openSelectionSelect()
  }

  const closeSelect = (lf: LfInstance) => {
    if (!lf?.closeSelectionSelect) return
    lf.closeSelectionSelect()
    forceAllowPan(lf)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Alt' && e.code !== 'AltLeft' && e.code !== 'AltRight') return
    if (isTypingTarget(e.target)) return
    if (altHeld) return
    altHeld = true
    // 阻止浏览器抢焦点到菜单栏（Windows）
    e.preventDefault()
    const lf = lfRef.value
    if (lf) openSelect(lf)
  }

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== 'Alt' && e.code !== 'AltLeft' && e.code !== 'AltRight') return
    if (!altHeld) return
    altHeld = false
    const lf = lfRef.value
    if (lf) closeSelect(lf)
  }

  const onBlur = () => {
    if (!altHeld) return
    altHeld = false
    const lf = lfRef.value
    if (lf) closeSelect(lf)
  }

  /** SelectionSelect 空白单击可能残留 stopMoveGraph，mouseup 后兜底 */
  const onBlankMouseUp = () => {
    if (altHeld) return
    const lf = lfRef.value
    if (!lf) return
    requestAnimationFrame(() => forceAllowPan(lf))
  }

  let boundLf: LfInstance | null = null

  const bindLf = (lf: LfInstance | null) => {
    if (boundLf) {
      boundLf.off?.('blank:mouseup', onBlankMouseUp)
      boundLf = null
    }
    if (!lf) return
    boundLf = lf
    lf.on('blank:mouseup', onBlankMouseUp)
    // 默认关闭框选，保证普通拖拽可平移
    closeSelect(lf)
  }

  watch(lfRef, (lf) => bindLf(lf), { immediate: true })

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    if (boundLf) {
      boundLf.off?.('blank:mouseup', onBlankMouseUp)
      if (altHeld) closeSelect(boundLf)
    }
  })
}
