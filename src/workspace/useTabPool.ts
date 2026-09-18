/**
 * 多流程 Tab 状态：打开 / 激活 / 关闭 / 脏标记。
 */
import { computed, ref } from 'vue'
import type { FlowDSL } from '@/types/flow'
import { newFlowId } from '@/canvas/adapter'
import { t } from '@/i18n'

/** 单个编辑器标签 */
export interface EditorTab {
  /** 与流程业务 ID 一致 */
  id: string
  title: string
  name: string
  entryNode: string
  dirty: boolean
  dsl: FlowDSL
  /**
   * 内容修订号：每次画布/名称等变更递增。
   * MCP get_active_flow / patch_active_flow 回传。
   */
  revision: number
  /** 流程锁定：画布只读，禁止保存 */
  locked?: boolean
  /** 已有线上发布版本 */
  published?: boolean
  /** 已保存草稿相对线上有未发布改动 */
  unpublishedChanges?: boolean
  /** 历史中有可恢复快照（未发布时可用于上线） */
  hasPublishHistory?: boolean
  /**
   * 新建时选定的分组；首次保存成功后写入服务端并清空。
   * 空字符串 / undefined 表示未分组。
   */
  pendingGroupId?: string
}

function emptyDsl(id: string, name: string): FlowDSL {
  return { id, name, entryNode: '', nodes: [], edges: [] }
}

/**
 * Tab 池 composable。
 */
export function useTabPool() {
  const tabs = ref<EditorTab[]>([])
  const activeId = ref<string | null>(null)

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeId.value) || null)

  function activate(id: string) {
    if (tabs.value.some((t) => t.id === id)) {
      activeId.value = id
    }
  }

  /** 新建空白流程并打开；groupId 非空时记入 pending，首次保存时写入 */
  function openNew(title = t('common.unnamedFlow'), groupId = ''): EditorTab {
    const id = newFlowId()
    const tab: EditorTab = {
      id,
      title,
      name: title,
      entryNode: '',
      dirty: true,
      revision: 1,
      published: false,
      unpublishedChanges: true,
      hasPublishHistory: false,
      dsl: emptyDsl(id, title),
      pendingGroupId: groupId || undefined,
    }
    tabs.value.push(tab)
    activeId.value = id
    return tab
  }

  /** 清除待写入分组（保存成功后调用） */
  function clearPendingGroup(id: string) {
    const t = tabs.value.find((x) => x.id === id)
    if (t) t.pendingGroupId = undefined
  }

  /** 打开已有 DSL；已打开则仅激活。force 时覆盖本地内容（含脏编辑）。 */
  function openDsl(
    dsl: FlowDSL,
    opts?: {
      force?: boolean
      locked?: boolean
      published?: boolean
      unpublishedChanges?: boolean
      hasPublishHistory?: boolean
    },
  ): EditorTab {
    const exist = tabs.value.find((t) => t.id === dsl.id)
    if (exist) {
      if (opts?.force || !exist.dirty) {
        exist.dsl = { ...dsl, nodes: [...(dsl.nodes || [])], edges: [...(dsl.edges || [])] }
        exist.name = dsl.name || exist.name
        exist.title = exist.name
        exist.entryNode = dsl.entryNode || ''
        exist.dirty = false
        exist.pendingGroupId = undefined
        // 内容被服务端覆盖：递增修订号，使旧 expectedRevision 失效
        exist.revision = (exist.revision || 0) + 1
      }
      if (opts?.locked !== undefined) {
        exist.locked = opts.locked
      }
      if (opts?.published !== undefined) {
        exist.published = opts.published
      }
      if (opts?.unpublishedChanges !== undefined) {
        exist.unpublishedChanges = opts.unpublishedChanges
      }
      if (opts?.hasPublishHistory !== undefined) {
        exist.hasPublishHistory = opts.hasPublishHistory
      }
      activate(exist.id)
      return exist
    }
    const tab: EditorTab = {
      id: dsl.id,
      title: dsl.name || dsl.id,
      name: dsl.name || dsl.id,
      entryNode: dsl.entryNode || '',
      dirty: false,
      revision: 1,
      locked: !!opts?.locked,
      published: !!opts?.published,
      unpublishedChanges: opts?.unpublishedChanges ?? !opts?.published,
      hasPublishHistory: !!opts?.hasPublishHistory,
      dsl: {
        ...dsl,
        nodes: [...(dsl.nodes || [])],
        edges: [...(dsl.edges || [])],
      },
    }
    tabs.value.push(tab)
    activeId.value = tab.id
    return tab
  }

  /** 更新 Tab 锁定态（列表点击切换后同步到已打开画布） */
  function setLocked(id: string, locked: boolean) {
    const t = tabs.value.find((x) => x.id === id)
    if (t) t.locked = locked
  }

  function setPublishMeta(
    id: string,
    meta: {
      published?: boolean
      unpublishedChanges?: boolean
      hasPublishHistory?: boolean
    },
  ) {
    const t = tabs.value.find((x) => x.id === id)
    if (!t) return
    if (meta.published !== undefined) t.published = meta.published
    if (meta.unpublishedChanges !== undefined) {
      t.unpublishedChanges = meta.unpublishedChanges
    }
    if (meta.hasPublishHistory !== undefined) {
      t.hasPublishHistory = meta.hasPublishHistory
    }
  }

  /**
   * 关闭标签。若关闭的是当前 tab，激活右邻否则左邻。
   * @returns 被关闭的 tab（调用方处理脏确认后再真正 close）
   */
  function peek(id: string) {
    return tabs.value.find((t) => t.id === id) || null
  }

  function close(id: string) {
    const idx = tabs.value.findIndex((t) => t.id === id)
    if (idx < 0) return
    tabs.value.splice(idx, 1)
    if (activeId.value !== id) return
    const next = tabs.value[idx] || tabs.value[idx - 1] || null
    activeId.value = next?.id ?? null
  }

  /** 内容变更：标脏并递增 revision */
  function bumpRevision(id: string): number {
    const t = tabs.value.find((x) => x.id === id)
    if (!t) return 0
    t.revision = (t.revision || 0) + 1
    return t.revision
  }

  function markDirty(id: string, dirty = true) {
    const t = tabs.value.find((x) => x.id === id)
    if (!t || t.locked) return
    if (dirty) {
      t.dirty = true
      bumpRevision(id)
    } else {
      t.dirty = false
    }
  }

  function updateName(id: string, name: string) {
    const t = tabs.value.find((x) => x.id === id)
    if (!t || t.locked) return
    t.name = name
    t.title = name
    t.dsl = { ...t.dsl, name }
    t.dirty = true
    bumpRevision(id)
  }

  function updateEntry(id: string, entryNode: string) {
    const t = tabs.value.find((x) => x.id === id)
    if (!t || t.locked) return
    t.entryNode = entryNode
    t.dsl = { ...t.dsl, entryNode }
    t.dirty = true
    bumpRevision(id)
  }

  /**
   * 保存成功：以本地刚提交的 DSL 为真相源，只清 dirty，不触发画布重载。
   * （不要用服务端回包整份替换 nodes/edges，否则会闪一下或丢编辑态。）
   */
  function markSaved(id: string, dsl: FlowDSL) {
    const t = tabs.value.find((x) => x.id === id)
    if (!t) return
    t.name = dsl.name || t.name
    t.title = t.name
    t.entryNode = dsl.entryNode || t.entryNode
    // 浅同步元数据；图数据保持当前引用，避免 FlowCanvas 无谓刷新
    if (t.dsl.name !== t.name || t.dsl.entryNode !== t.entryNode) {
      t.dsl = { ...t.dsl, name: t.name, entryNode: t.entryNode }
    }
    t.dirty = false
  }

  return {
    tabs,
    activeId,
    activeTab,
    activate,
    openNew,
    openDsl,
    peek,
    close,
    markDirty,
    bumpRevision,
    updateName,
    updateEntry,
    markSaved,
    clearPendingGroup,
    setLocked,
    setPublishMeta,
  }
}
