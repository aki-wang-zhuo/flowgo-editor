/**
 * 编辑器全局快捷键：保存 / 刷新 / 撤销 / 重做 / 删除选中。
 * 保存、刷新始终拦截（含输入框内），避免浏览器「保存网页」等默认行为；
 * 撤销 / 重做 / 删除在输入框、文本域内不拦截，避免干扰打字。
 */
import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import type { LfInstance } from '@/canvas/lf-types'

export interface EditorHotkeyHandlers {
  /** Ctrl/Cmd + S */
  save: () => void
  /** Ctrl/Cmd + Shift + R：从服务器刷新当前流程 */
  refresh?: () => void
  /** 当前激活画布的 LogicFlow 实例 */
  getActiveLf: () => LfInstance | null
  /** 撤销/重做/删除后回调（用于标记 dirty） */
  onHistoryChange?: () => void
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  // CodeMirror / Element Plus 输入区
  return !!el.closest?.(
    '[contenteditable="true"], .el-input, .el-textarea, .cm-editor, .cm-content',
  )
}

function isMod(e: KeyboardEvent) {
  return e.ctrlKey || e.metaKey
}

/** 删除当前画布选中的节点与边 */
function deleteSelected(lf: LfInstance | null) {
  if (!lf) return false
  const elements = lf.getSelectElements?.(true) as
    | { nodes?: { id?: string }[]; edges?: { id?: string }[] }
    | undefined
  if (!elements) return false
  const nodes = elements.nodes || []
  const edges = elements.edges || []
  if (!nodes.length && !edges.length) return false
  lf.clearSelectElements?.()
  edges.forEach((edge) => edge.id && lf.deleteEdge?.(edge.id))
  nodes.forEach((node) => node.id && lf.deleteNode?.(node.id))
  return true
}

/**
 * 绑定窗口级快捷键（捕获阶段，避免与 LogicFlow 内置快捷键重复触发）。
 */
export function useEditorHotkeys(
  handlers: EditorHotkeyHandlers,
  enabled: Ref<boolean> | boolean = true,
) {
  const onKeyDown = (e: KeyboardEvent) => {
    const on = typeof enabled === 'boolean' ? enabled : enabled.value
    if (!on) return

    const typing = isTypingTarget(e.target)
    const lf = handlers.getActiveLf()

    // —— 全局拦截：即使在输入框内也处理，并阻止浏览器默认行为 ——
    if (isMod(e)) {
      const key = e.key.toLowerCase()

      // 保存：Ctrl/Cmd + S
      if (key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        handlers.save()
        return
      }

      // 刷新：Ctrl/Cmd + Shift + R（拦截浏览器硬刷新）
      if (key === 'r' && e.shiftKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        handlers.refresh?.()
        return
      }
    }

    // —— 以下快捷键在打字时不拦截 ——
    if (typing) return

    // 删除：Delete / Backspace（无修饰键）
    if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      !isMod(e) &&
      !e.altKey &&
      !e.shiftKey
    ) {
      e.preventDefault()
      e.stopPropagation()
      if (deleteSelected(lf)) {
        handlers.onHistoryChange?.()
      }
      return
    }

    if (!isMod(e)) return

    const key = e.key.toLowerCase()

    // 撤销：Ctrl/Cmd + Z（不含 Shift）
    if (key === 'z' && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      e.stopPropagation()
      lf?.undo?.()
      handlers.onHistoryChange?.()
      return
    }

    // 重做：Ctrl/Cmd + Shift + Z，或 Ctrl/Cmd + Y
    if ((key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)) {
      e.preventDefault()
      e.stopPropagation()
      lf?.redo?.()
      handlers.onHistoryChange?.()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown, true)
  })
}
