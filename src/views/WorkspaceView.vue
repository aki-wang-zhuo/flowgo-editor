<script setup lang="ts">
/**
 * 工作区：多 Tab 流程编辑 + 左侧「我的流程 / 节点」Dock。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import type { LfInstance } from '@/canvas/lf-types'
import { getFlow, saveFlow, setFlowGroup, publishFlow, discardDraft, type FlowRecord } from '@/api/flow'
import { getMcpSettings } from '@/api/settings'
import { dslToGraph, graphToDsl } from '@/canvas/adapter'
import { useTabPool } from '@/workspace/useTabPool'
import { useEditorHotkeys } from '@/workspace/useEditorHotkeys'
import { usePanelLayout } from '@/workspace/usePanelLayout'
import {
  readLastActiveFlowId,
  writeLastActiveFlowId,
} from '@/workspace/lastActiveFlow'
import {
  useServerWs,
  type ActiveFlowReplyPayload,
  type EditorCommandPayload,
  type EditorPatchPayload,
  type EditorQueryPayload,
  type FlowChangedPayload,
} from '@/workspace/useServerWs'
import {
  applyActiveFlowPatch,
  type ActiveFlowPatch,
} from '@/workspace/applyActiveFlowPatch'
import TabBar from '@/workspace/TabBar.vue'
import LeftDock from '@/components/editor/LeftDock.vue'
import FlowEditorPane from '@/components/editor/FlowEditorPane.vue'
import PropertyPanel from '@/components/editor/PropertyPanel.vue'
import PublishHistoryDialog from '@/components/editor/PublishHistoryDialog.vue'
import LocaleSwitcher from '@/components/topbar/LocaleSwitcher.vue'
import UserMenu from '@/components/topbar/UserMenu.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
const { t } = useI18n()

const {
  tabs,
  activeId,
  activeTab,
  activate,
  openNew,
  openDsl,
  peek,
  close,
  markDirty,
  updateName,
  updateEntry,
  markSaved,
  clearPendingGroup,
  setLocked,
  setPublishMeta,
} = useTabPool()

const { leftWidth, rightWidth, startLeftResize, startRightResize } = usePanelLayout()

const paneRefs = ref<Record<string, InstanceType<typeof FlowEditorPane> | null>>({})
const lfByTab = ref<Record<string, LfInstance>>({})
const selectedByTab = ref<Record<string, string | null>>({})

const saving = ref(false)
const publishing = ref(false)
const refreshing = ref(false)
const historyOpen = ref(false)
const createVisible = ref(false)
const settingsVisible = ref(false)
/** MCP 全局开关：关闭时不连接编辑器 WebSocket */
const mcpEnabled = ref(true)
const dockRef = ref<InstanceType<typeof LeftDock> | null>(null)
const openIds = computed(() => tabs.value.map((t) => t.id))

function flowOpenOpts(rec: FlowRecord) {
  return {
    locked: !!rec.locked,
    published: !!rec.published,
    unpublishedChanges: !!rec.unpublishedChanges,
  }
}

function applyRecordMeta(rec: FlowRecord) {
  setLocked(rec.id, !!rec.locked)
  setPublishMeta(rec.id, {
    published: !!rec.published,
    unpublishedChanges: !!rec.unpublishedChanges,
  })
}
const activeLf = computed(() => {
  const id = activeId.value
  return id ? lfByTab.value[id] || null : null
})
const activeSelected = computed(() => {
  const id = activeId.value
  return id ? selectedByTab.value[id] ?? null : null
})
/** 当前激活流程是否锁定 */
const activeLocked = computed(() => !!activeTab.value?.locked)

/**
 * 将锁定态同步到 LogicFlow（静默模式）。
 * 各 Tab 的 FlowCanvas 也会 watch locked；此处保证切换 Tab 时立刻生效。
 */
function syncLfLock(flowId: string, locked: boolean) {
  const lf = lfByTab.value[flowId]
  if (!lf?.updateEditConfig) return
  lf.updateEditConfig({ isSilentMode: locked })
  // 静默模式会放开滚轮平移；锁定后仍保持滚轮缩放
  if (locked) {
    lf.updateEditConfig({ stopScrollGraph: true, stopZoomGraph: false })
  }
}

/** 从服务端重新拉取并打开流程（可覆盖脏编辑，由调用方确认） */
async function reloadFlowFromServer(flowId: string, force = false): Promise<boolean> {
  const tab = peek(flowId)
  if (tab?.dirty && !force) {
    ElMessage.warning(t('workspace.dirtyExternalUpdate', { title: tab.title }))
    return false
  }
  try {
    const full = await getFlow(flowId)
    if (!full.dsl) {
      ElMessage.error(t('workspace.emptyDsl'))
      return false
    }
    openDsl(full.dsl, { force, ...flowOpenOpts(full) })
    dockRef.value?.upsertFlow(full)
    const lf = lfByTab.value[flowId]
    if (lf) {
      lf.render(dslToGraph(full.dsl) as unknown as Record<string, unknown>)
      syncLfLock(flowId, !!full.locked)
      requestAnimationFrame(() => {
        lf.resize?.()
        requestAnimationFrame(() => {
          if (full.dsl?.nodes?.length) lf.fitView?.(40, 40)
        })
      })
    }
    return true
  } catch {
    ElMessage.error(t('workspace.refreshFailed'))
    return false
  }
}

function onWsFlowChanged(p: FlowChangedPayload) {
  if (!p.id) return

  if (p.action === 'deleted') {
    dockRef.value?.removeFlow(p.id)
    if (peek(p.id)) forceCloseTab(p.id)
    return
  }

  // 锁定状态变更：同步列表与已打开画布只读态
  if (p.action === 'lock') {
    void (async () => {
      try {
        const full = await getFlow(p.id)
        dockRef.value?.upsertFlow(full)
        onFlowLocked(full)
      } catch {
        /* 忽略 */
      }
    })()
    return
  }

  // 本机 API 保存：列表已 upsert，不再整表重拉
  if (p.source === 'api') {
    if (p.name) {
      dockRef.value?.upsertFlow({ id: p.id, name: p.name } as FlowRecord)
    }
    return
  }

  // MCP 等外部变更：不整表刷新列表
  void (async () => {
    const existsInList = dockRef.value?.hasFlow(p.id) ?? false
    if (!existsInList) {
      // 列表没有 → 拉取后动态加入并打开
      try {
        const full = await getFlow(p.id)
        dockRef.value?.upsertFlow(full)
        if (full.dsl) openDsl(full.dsl, flowOpenOpts(full))
        else ElMessage.warning(t('workspace.mcpAddedEmptyDsl'))
      } catch {
        ElMessage.error(t('workspace.mcpLoadFailed'))
      }
      return
    }
    // 列表已有：仅更新名称；若已打开且未脏则刷画布
    if (p.name) {
      dockRef.value?.upsertFlow({ id: p.id, name: p.name } as FlowRecord)
    }
    if (peek(p.id)) {
      void reloadFlowFromServer(p.id, false)
    }
  })()
}

async function onWsEditorCommand(p: EditorCommandPayload) {
  switch (p.action) {
    case 'reload_flows':
      dockRef.value?.reloadFlows()
      ElMessage.info(t('workspace.listRefreshed'))
      break
    case 'refresh_canvas': {
      const id = p.flowId || activeId.value
      if (!id) {
        ElMessage.info(t('workspace.nothingToRefresh'))
        return
      }
      const tab = peek(id)
      if (tab?.dirty) {
        try {
          await ElMessageBox.confirm(
            t('workspace.refreshCanvasConfirm', { title: tab.title }),
            t('workspace.refreshCanvasTitle'),
            {
              type: 'warning',
              confirmButtonText: t('workspace.refreshConfirmBtn'),
              cancelButtonText: t('common.cancel'),
            },
          )
        } catch {
          return
        }
      }
      const ok = await reloadFlowFromServer(id, true)
      if (ok) ElMessage.success(t('workspace.canvasRefreshed'))
      break
    }
    case 'open_flow': {
      if (!p.flowId) {
        ElMessage.warning(t('workspace.missingFlowId'))
        return
      }
      await openRecord({ id: p.flowId } as FlowRecord)
      break
    }
    default:
      break
  }
}

/**
 * MCP get_active_flow：回报当前激活 Tab；includeDsl 时导出画布（含未保存修改）。
 */
function onWsEditorQuery(p: EditorQueryPayload) {
  const requestId = (p.requestId || '').trim()
  if (!requestId) return
  const openIds = tabs.value.map((t) => t.id)
  const tab = activeTab.value
  if (!tab) {
    sendActiveFlow({ requestId, active: false, openIds })
    return
  }
  const reply: ActiveFlowReplyPayload = {
    requestId,
    active: true,
    flowId: tab.id,
    name: tab.name,
    dirty: !!tab.dirty,
    locked: !!tab.locked,
    revision: tab.revision || 0,
    openIds,
  }
  if (p.includeDsl !== false) {
    const pane = paneRefs.value[tab.id]
    if (pane?.getGraphData) {
      reply.dsl = graphToDsl(pane.getGraphData(), {
        id: tab.id,
        name: tab.name,
        entryNode: tab.entryNode,
      })
    } else if (tab.dsl) {
      reply.dsl = tab.dsl
    }
  }
  sendActiveFlow(reply)
}

/**
 * MCP patch_active_flow：仅应用变更项到当前激活画布，回报 applied（及可选完整 DSL）。
 */
function onWsEditorPatch(p: EditorPatchPayload) {
  const requestId = (p.requestId || '').trim()
  if (!requestId) return
  const tab = activeTab.value
  if (!tab) {
    sendPatchedFlow({
      requestId,
      ok: false,
      message: 'no active flow',
      errors: [{ path: '', message: 'no active flow' }],
    })
    return
  }
  if (p.flowId && p.flowId !== tab.id) {
    sendPatchedFlow({
      requestId,
      ok: false,
      flowId: tab.id,
      name: tab.name,
      message: 'flowId mismatch',
      errors: [{ path: 'flowId', message: `active is ${tab.id}` }],
    })
    return
  }
  const lf = lfByTab.value[tab.id]
  const pane = paneRefs.value[tab.id]
  if (!lf || !pane?.getGraphData) {
    sendPatchedFlow({
      requestId,
      ok: false,
      flowId: tab.id,
      message: 'canvas not ready',
      errors: [{ path: '', message: 'canvas not ready' }],
    })
    return
  }
  const patch = (p.patch || {}) as ActiveFlowPatch
  const result = applyActiveFlowPatch({
    lf,
    tab: {
      id: tab.id,
      name: tab.name,
      entryNode: tab.entryNode,
      locked: tab.locked,
    },
    patch,
    getGraphData: () => pane.getGraphData(),
    includeDsl: p.includeDsl !== false,
  })
  if (result.applied.name) {
    updateName(tab.id, result.applied.name)
  }
  if (result.applied.entryNode != null) {
    updateEntry(tab.id, result.applied.entryNode)
  }
  // 节点/边变更才额外 bump（名称/入口已由 update* 递增）
  if (result.applied.nodes.length || result.applied.edges.length) {
    markDirty(tab.id, true)
  }
  if (result.dsl) {
    tab.dsl = result.dsl
  }
  const rev = peek(tab.id)?.revision || 0
  sendPatchedFlow({
    requestId,
    ok: result.ok,
    flowId: tab.id,
    name: result.applied.name || tab.name,
    dirty: !!peek(tab.id)?.dirty,
    locked: !!tab.locked,
    revision: rev,
    applied: result.applied,
    errors: result.errors,
    dsl: result.dsl,
    message: result.message,
  })
}

const {
  status: wsStatus,
  connect: connectWs,
  disconnect: disconnectWs,
  sendActiveFlow,
  sendPatchedFlow,
} = useServerWs({
  onFlowChanged: onWsFlowChanged,
  onEditorCommand: (p) => {
    void onWsEditorCommand(p)
  },
  onEditorQuery: onWsEditorQuery,
  onEditorPatch: onWsEditorPatch,
  canReconnect: async () => {
    try {
      const cfg = await getMcpSettings()
      mcpEnabled.value = cfg.enabled !== false
      return mcpEnabled.value
    } catch {
      return true
    }
  },
})

/** 按 MCP 全局开关连接或断开 WebSocket */
function syncWsWithMcp(enabled: boolean) {
  mcpEnabled.value = enabled
  if (enabled) connectWs()
  else disconnectWs()
}

onMounted(() => {
  void (async () => {
    try {
      const cfg = await getMcpSettings()
      syncWsWithMcp(cfg.enabled !== false)
    } catch {
      // 设置拉取失败时仍尝试连接，避免整页无实时能力
      syncWsWithMcp(true)
    }
  })()
  void restoreLastActiveFlow()
})

function onMcpChanged(payload: { enabled: boolean }) {
  syncWsWithMcp(!!payload.enabled)
}

/** 持久化当前激活流程，供下次打开自动恢复 */
watch(activeId, (id) => {
  writeLastActiveFlowId(id)
})

/**
 * 打开上次激活的流程；若不存在（已删除 / 无权限）则清除记录且不打开。
 */
async function restoreLastActiveFlow() {
  const id = readLastActiveFlowId()
  if (!id) return
  // 已在 Tab 中则只激活
  if (peek(id)) {
    activate(id)
    return
  }
  try {
    const full = await getFlow(id)
    if (!full.dsl) {
      writeLastActiveFlowId(null)
      return
    }
    openDsl(full.dsl, flowOpenOpts(full))
    dockRef.value?.upsertFlow(full)
  } catch {
    writeLastActiveFlowId(null)
  }
}

function setPaneRef(id: string, el: unknown) {
  paneRefs.value[id] = (el as InstanceType<typeof FlowEditorPane>) || null
}

function onPaneReady(tabId: string, lf: LfInstance) {
  lfByTab.value[tabId] = lf
  const tab = peek(tabId)
  syncLfLock(tabId, !!tab?.locked)
}

function onSelectNode(tabId: string, nodeId: string | null) {
  selectedByTab.value[tabId] = nodeId
}

function onGraphChange(tabId: string) {
  const tab = peek(tabId)
  if (tab?.locked) return
  markDirty(tabId, true)
  const lf = lfByTab.value[tabId]
  if (!lf || !tab || tab.entryNode) return
  const data = lf.getGraphData() as { nodes?: { id: string }[] }
  const first = data.nodes?.[0]
  if (first) setEntry(first.id)
}

function setEntry(nodeId: string) {
  const id = activeId.value
  if (!id) return
  updateEntry(id, nodeId)
  const lf = lfByTab.value[id]
  if (!lf) return
  const data = lf.getGraphData() as { nodes?: { id: string }[] }
  for (const n of data.nodes || []) {
    const model = lf.getNodeModelById(n.id)
    if (!model) continue
    lf.setProperties(n.id, { ...model.properties, isEntry: n.id === nodeId })
  }
}

/** 打开新建流程对话框（标签栏 + / 左侧加号菜单） */
function onNew() {
  createVisible.value = true
}

function onCreateConfirm(payload: { name: string; groupId: string }) {
  openNew(payload.name, payload.groupId)
}

/**
 * 从流程列表打开：已打开的 Tab 只激活，不重新拉后端；
 * 仅首次打开才 getFlow。手动刷新走 onRefresh。
 */
async function openRecord(rec: FlowRecord) {
  if (!rec?.id) return
  if (peek(rec.id)) {
    activate(rec.id)
    applyRecordMeta(rec)
    syncLfLock(rec.id, !!rec.locked)
    return
  }
  try {
    const full = await getFlow(rec.id)
    if (!full.dsl) {
      ElMessage.error(t('workspace.emptyDsl'))
      return
    }
    openDsl(full.dsl, flowOpenOpts(full))
    dockRef.value?.upsertFlow(full)
  } catch {
    ElMessage.error(t('workspace.openFailed'))
  }
}

/** 列表点击锁图标后：同步已打开 Tab 的只读态 */
function onFlowLocked(rec: FlowRecord) {
  if (!rec?.id) return
  setLocked(rec.id, !!rec.locked)
  syncLfLock(rec.id, !!rec.locked)
}

async function onCloseTab(id: string) {
  const tab = peek(id)
  if (!tab) return
  if (tab.dirty) {
    try {
      await ElMessageBox.confirm(
        t('workspace.closeDirtyConfirm', { title: tab.title }),
        t('common.prompt'),
        {
          type: 'warning',
          distinguishCancelAndClose: true,
          confirmButtonText: t('workspace.closeConfirmBtn'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
  }
  forceCloseTab(id)
}

/** 从列表删除流程后强制关闭对应 Tab（不再二次确认） */
function onFlowDeleted(id: string) {
  if (peek(id)) forceCloseTab(id)
}

function forceCloseTab(id: string) {
  close(id)
  delete paneRefs.value[id]
  delete lfByTab.value[id]
  delete selectedByTab.value[id]
}

/** 工具栏「刷新」：从服务器重新拉取指定/当前流程；有未保存更改时先确认 */
async function onRefresh(flowId?: string) {
  const id = flowId || activeId.value
  if (!id) {
    ElMessage.info(t('workspace.openFlowFirst'))
    return
  }
  // 仅允许刷新当前激活画布，避免误操作隐藏 Tab
  if (id !== activeId.value) {
    activate(id)
  }
  const tab = peek(id)
  if (tab?.dirty) {
    try {
      await ElMessageBox.confirm(
        t('workspace.refreshCanvasConfirm', { title: tab.title }),
        t('workspace.refreshFlowTitle'),
        {
          type: 'warning',
          confirmButtonText: t('workspace.refreshConfirmBtn'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
  }
  refreshing.value = true
  try {
    const ok = await reloadFlowFromServer(id, true)
    if (ok) ElMessage.success(t('workspace.refreshedFromServer'))
  } finally {
    refreshing.value = false
  }
}

async function onSave(flowId?: string): Promise<boolean> {
  const id = flowId || activeId.value
  if (!id) {
    ElMessage.info(t('workspace.openOrCreateFirst'))
    return false
  }
  if (id !== activeId.value) {
    activate(id)
  }
  const tab = peek(id)
  if (!tab) {
    ElMessage.info(t('workspace.openOrCreateFirst'))
    return false
  }
  if (tab.locked) {
    ElMessage.warning(t('workspace.lockedCannotSave'))
    return false
  }
  const pane = paneRefs.value[tab.id]
  if (!pane) return false
  saving.value = true
  try {
    const graph = pane.getGraphData()
    const dsl = graphToDsl(graph, {
      id: tab.id,
      name: tab.name,
      entryNode: tab.entryNode,
    })
    if (!dsl.entryNode && dsl.nodes.length > 0) {
      dsl.entryNode = dsl.nodes[0].id
      updateEntry(tab.id, dsl.entryNode)
    }
    let saved = await saveFlow(dsl)
    // 新建时选择的分组：首次保存后写入
    if (tab.pendingGroupId) {
      saved = await setFlowGroup(tab.id, tab.pendingGroupId)
      clearPendingGroup(tab.id)
    }
    markSaved(tab.id, dsl)
    applyRecordMeta(saved)
    dockRef.value?.upsertFlow(saved)
    ElMessage.success(t('workspace.saved'))
    return true
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('common.saveFailed')
    ElMessage.error(msg)
    return false
  } finally {
    saving.value = false
  }
}

async function onPublish(flowId?: string) {
  const id = flowId || activeId.value
  if (!id) {
    ElMessage.info(t('workspace.openOrCreateFirst'))
    return
  }
  const tab = peek(id)
  if (!tab || tab.locked) {
    ElMessage.warning(t('workspace.lockedCannotSave'))
    return
  }
  if (tab.dirty) {
    const ok = await onSave(id)
    if (!ok) return
  }
  let note = ''
  try {
    const { value } = await ElMessageBox.prompt(
      t('workspace.publishNotePrompt'),
      t('workspace.publishTitle'),
      {
        confirmButtonText: t('workspace.publishConfirm'),
        cancelButtonText: t('common.cancel'),
        inputPlaceholder: t('workspace.publishNotePlaceholder'),
        inputValue: '',
        inputValidator: () => true,
      },
    )
    note = String(value || '').trim()
  } catch {
    return
  }
  publishing.value = true
  try {
    const rec = await publishFlow(id, note)
    applyRecordMeta(rec)
    dockRef.value?.upsertFlow(rec)
    ElMessage.success(t('workspace.published'))
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      t('workspace.publishFailed')
    ElMessage.error(msg)
  } finally {
    publishing.value = false
  }
}

async function onDiscardDraft(flowId?: string) {
  const id = flowId || activeId.value
  if (!id) return
  const tab = peek(id)
  if (!tab || tab.locked) {
    ElMessage.warning(t('workspace.lockedCannotSave'))
    return
  }
  if (!tab.published) {
    ElMessage.warning(t('workspace.discardNeedPublished'))
    return
  }
  try {
    await ElMessageBox.confirm(t('workspace.discardConfirm'), t('workspace.discardTitle'), {
      type: 'warning',
    })
  } catch {
    return
  }
  publishing.value = true
  try {
    const rec = await discardDraft(id)
    dockRef.value?.upsertFlow(rec)
    await reloadFlowFromServer(id, true)
    ElMessage.success(t('workspace.discarded'))
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      t('workspace.discardFailed')
    ElMessage.error(msg)
  } finally {
    publishing.value = false
  }
}

function onHistory() {
  if (!activeId.value) {
    ElMessage.info(t('workspace.openOrCreateFirst'))
    return
  }
  historyOpen.value = true
}

async function onRolledBack() {
  const id = activeId.value
  if (!id) return
  await reloadFlowFromServer(id, false)
  ElMessage.success(t('workspace.rolledBack'))
}

/** 画布快捷栏：保存/刷新当前面板对应流程 */
function onPaneSave(tabId: string) {
  void onSave(tabId)
}

function onPaneRefresh(tabId: string) {
  void onRefresh(tabId)
}

function onPanePublish(tabId: string) {
  void onPublish(tabId)
}

function onPaneDiscard(tabId: string) {
  void onDiscardDraft(tabId)
}

/** 快捷键：Ctrl+S 保存；Ctrl+Z 撤销；Ctrl+Shift+Z / Ctrl+Y 重做 */
useEditorHotkeys({
  save: () => {
    void onSave()
  },
  refresh: () => {
    void onRefresh()
  },
  getActiveLf: () => activeLf.value,
  onHistoryChange: () => {
    const id = activeId.value
    if (!id) return
    markDirty(id, true)
    selectedByTab.value[id] = null
  },
})

function onFlowName(id: string, v: string) {
  const tab = peek(id)
  if (tab?.locked) {
    ElMessage.warning(t('workspace.lockedCannotRename'))
    return
  }
  updateName(id, v)
}

function onPropChange() {
  const id = activeId.value
  if (id) markDirty(id, true)
}

/** 节点开关变更后刷新左侧面板，并为已打开画布补注册类型 */
function onComponentsChanged() {
  void (async () => {
    const { loadComponentGroups, cachedComponentTypes } = await import(
      '@/canvas/componentCatalog'
    )
    const { registerFlowNodes } = await import('@/canvas/registerNodes')
    await loadComponentGroups(true)
    dockRef.value?.reloadPalette?.()
    const types = cachedComponentTypes()
    for (const lf of Object.values(lfByTab.value)) {
      if (lf) registerFlowNodes(lf as never, types)
    }
  })()
}

</script>

<template>
  <div class="workspace">
    <header class="topbar">
      <div class="left">
        <span class="brand">FlowGo</span>
        <span class="sub">{{ t('workspace.subtitle') }}</span>
      </div>
      <div class="right">
        <span
          class="ws-dot"
          :class="mcpEnabled ? `is-${wsStatus}` : 'is-disconnected'"
          :title="
            !mcpEnabled
              ? t('workspace.wsMcpDisabled')
              : wsStatus === 'connected'
                ? t('workspace.wsConnected')
                : wsStatus === 'connecting'
                  ? t('workspace.wsConnecting')
                  : t('workspace.wsDisconnected')
          "
        />
        <LocaleSwitcher />
        <button
          type="button"
          class="icon-btn"
          :title="t('workspace.settingsTitle')"
          @click="settingsVisible = true"
        >
          <el-icon :size="16"><Setting /></el-icon>
        </button>
        <UserMenu @before-logout="disconnectWs" />
      </div>
    </header>

    <TabBar
      :tabs="tabs"
      :active-id="activeId"
      @activate="activate"
      @close="onCloseTab"
      @create="onNew"
      @rename="onFlowName"
    />

    <div class="body">
      <LeftDock
        ref="dockRef"
        :lf="activeLf"
        :open-ids="openIds"
        :active-id="activeId"
        :canvas-locked="activeLocked"
        :width="leftWidth"
        @open-flow="openRecord"
        @create-flow="onNew"
        @deleted-flow="onFlowDeleted"
        @locked-flow="onFlowLocked"
      />
      <div
        class="splitter"
        :title="t('workspace.resizeLeft')"
        @mousedown="startLeftResize"
      />

      <div class="center">
        <FlowEditorPane
          v-for="tab in tabs"
          :key="tab.id"
          :ref="(el) => setPaneRef(tab.id, el)"
          :tab-id="tab.id"
          :dsl="tab.dsl"
          :active="tab.id === activeId"
          :dirty="tab.dirty"
          :locked="!!tab.locked"
          :published="!!tab.published"
          :unpublished-changes="!!tab.unpublishedChanges"
          :saving="saving && tab.id === activeId"
          :publishing="publishing && tab.id === activeId"
          :refreshing="refreshing && tab.id === activeId"
          @ready="onPaneReady"
          @select-node="onSelectNode"
          @graph-change="onGraphChange"
          @save="onPaneSave"
          @refresh="onPaneRefresh"
          @publish="onPanePublish"
          @discard="onPaneDiscard"
          @history="onHistory"
        />
        <div v-if="!tabs.length" class="center__empty">
          {{ t('workspace.emptyHint') }}
        </div>
      </div>

      <div
        class="splitter"
        :title="t('workspace.resizeRight')"
        @mousedown="startRightResize"
      />
      <PropertyPanel
        :lf="activeLf"
        :node-id="activeSelected"
        :width="rightWidth"
        :readonly="activeLocked"
        @change="onPropChange"
      />
    </div>

    <CreateFlowDialog v-model="createVisible" @confirm="onCreateConfirm" />
    <PublishHistoryDialog
      v-model="historyOpen"
      :flow-id="activeId || ''"
      :locked="activeLocked"
      @rolled-back="onRolledBack"
    />
    <SettingsDialog
      v-model="settingsVisible"
      @components-changed="onComponentsChanged"
      @mcp-changed="onMcpChanged"
    />
  </div>
</template>

<style scoped>
.workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f3f3;
  overflow: hidden;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 1rem;
  background: #0f172a;
  color: #f8fafc;
  flex-shrink: 0;
}
.brand {
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-right: 0.75rem;
}
.sub {
  color: #94a3b8;
  font-size: 0.9rem;
}
.right {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.35);
  color: #e2e8f0;
  cursor: pointer;
}
.icon-btn:hover {
  border-color: rgba(148, 163, 184, 0.7);
  background: rgba(30, 41, 59, 0.8);
}
.ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 0.5rem;
  flex-shrink: 0;
  background: #64748b;
}
.ws-dot.is-connected {
  background: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
}
.ws-dot.is-connecting {
  background: #eab308;
}
.ws-dot.is-disconnected {
  background: #ef4444;
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.splitter {
  width: 4px;
  flex-shrink: 0;
  cursor: col-resize;
  background: #ddd;
  position: relative;
  z-index: 2;
}
.splitter:hover,
.splitter:active {
  background: #409eff;
}
.center {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  background: #f8fafc;
}
.center__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #888;
  font-size: 13px;
}
</style>
