<script setup lang="ts">
/**
 * 左侧「我的流程」：按分组展示，支持分组 CRUD、流程删除 / 移组 / 复制。
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, Expand, Fold, Lock, Plus, Refresh, Search, Unlock } from '@element-plus/icons-vue'
import {
  deleteFlow,
  listFlows,
  setFlowGroup,
  setFlowLocked,
  type FlowRecord,
} from '@/api/flow'
import {
  createFlowGroup,
  deleteFlowGroup,
  listFlowGroups,
  renameFlowGroup,
  type FlowGroup,
} from '@/api/group'
import FlowItemMoreMenu from '@/components/editor/flows/FlowItemMoreMenu.vue'
import { duplicateFlowAsCopy } from '@/components/editor/flows/duplicateFlow'

/** 未分组虚拟 id，仅用于折叠面板 name */
const UNGROUPED = '__ungrouped__'

const props = defineProps<{
  openIds: string[]
  activeId: string | null
}>()

const emit = defineEmits<{
  open: [flow: FlowRecord]
  create: []
  /** 流程已从服务端删除，父级需关闭对应 Tab */
  deleted: [flowId: string]
  /** 锁定状态变更，父级同步已打开画布只读态 */
  locked: [flow: FlowRecord]
}>()

const { t } = useI18n()

const loading = ref(false)
const keyword = ref('')
const flows = ref<FlowRecord[]>([])
const groups = ref<FlowGroup[]>([])
const error = ref('')
/** 展开的分组 id（含未分组） */
const expanded = ref<string[]>([])

const filteredFlows = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return flows.value
  return flows.value.filter(
    (f) => f.name?.toLowerCase().includes(q) || f.id.toLowerCase().includes(q),
  )
})

/** 按分组聚合后的区块列表（含空分组与未分组） */
const sections = computed(() => {
  const list = filteredFlows.value
  const byGroup = new Map<string, FlowRecord[]>()
  for (const f of list) {
    const gid = f.groupId || UNGROUPED
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid)!.push(f)
  }
  const out: { id: string; name: string; flows: FlowRecord[]; removable: boolean }[] = []
  for (const g of groups.value) {
    out.push({
      id: g.id,
      name: g.name,
      flows: byGroup.get(g.id) || [],
      removable: true,
    })
  }
  out.push({
    id: UNGROUPED,
    name: t('common.ungrouped'),
    flows: byGroup.get(UNGROUPED) || [],
    removable: false,
  })
  return out
})

async function reload() {
  loading.value = true
  error.value = ''
  try {
    const [f, g] = await Promise.all([listFlows(), listFlowGroups()])
    flows.value = f
    groups.value = g
    // 默认展开全部（含未分组）
    const ids = [...g.map((x) => x.id), UNGROUPED]
    if (!expanded.value.length) {
      expanded.value = ids
    } else {
      // 保留已展开态，补上新建分组
      const set = new Set(expanded.value)
      for (const id of ids) set.add(id)
      expanded.value = [...set]
    }
  } catch {
    error.value = t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

function isOpen(id: string) {
  return props.openIds.includes(id)
}

/** 当前可见的全部分组 id（含未分组） */
function allSectionIds(): string[] {
  return sections.value.map((s) => s.id)
}

/** 展开全部子分组 */
function expandAll() {
  expanded.value = allSectionIds()
}

/** 收起全部子分组 */
function collapseAll() {
  expanded.value = []
}

onMounted(reload)

function upsert(rec: FlowRecord) {
  const idx = flows.value.findIndex((f) => f.id === rec.id)
  if (idx >= 0) {
    flows.value[idx] = { ...flows.value[idx], ...rec }
  } else {
    flows.value = [rec, ...flows.value]
  }
}

function removeLocal(id: string) {
  flows.value = flows.value.filter((f) => f.id !== id)
}

function hasFlow(id: string) {
  return flows.value.some((f) => f.id === id)
}

async function onCreateGroup() {
  try {
    const { value } = await ElMessageBox.prompt(t('flows.createGroupPrompt'), t('flows.createGroupTitle'), {
      confirmButtonText: t('common.create'),
      cancelButtonText: t('common.cancel'),
      inputPattern: /\S+/,
      inputErrorMessage: t('common.nameRequired'),
    })
    const g = await createFlowGroup(value.trim())
    groups.value = [...groups.value, g]
    if (!expanded.value.includes(g.id)) {
      expanded.value = [...expanded.value, g.id]
    }
    ElMessage.success(t('flows.groupCreated'))
  } catch {
    /* 取消或失败 */
  }
}

/** 加号菜单：新建流程 / 新建分组 */
function onPlusCommand(cmd: string) {
  if (cmd === 'group') {
    void onCreateGroup()
    return
  }
  if (cmd === 'flow') {
    emit('create')
  }
}

async function onRenameGroup(g: { id: string; name: string }) {
  if (g.id === UNGROUPED) return
  try {
    const { value } = await ElMessageBox.prompt(t('flows.renameGroupPrompt'), t('flows.renameTitle'), {
      confirmButtonText: t('common.save'),
      cancelButtonText: t('common.cancel'),
      inputValue: g.name,
      inputPattern: /\S+/,
      inputErrorMessage: t('common.nameRequired'),
    })
    const updated = await renameFlowGroup(g.id, value.trim())
    const idx = groups.value.findIndex((x) => x.id === g.id)
    if (idx >= 0) groups.value[idx] = updated
    ElMessage.success(t('flows.renamed'))
  } catch {
    /* 取消 */
  }
}

async function onDeleteGroup(g: { id: string; name: string }, ev: Event) {
  ev.stopPropagation()
  if (g.id === UNGROUPED) return
  try {
    await ElMessageBox.confirm(
      t('flows.deleteGroupConfirm', { name: g.name }),
      t('flows.deleteGroupTitle'),
      { type: 'warning', confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel') },
    )
    await deleteFlowGroup(g.id)
    groups.value = groups.value.filter((x) => x.id !== g.id)
    for (const f of flows.value) {
      if (f.groupId === g.id) f.groupId = ''
    }
    expanded.value = expanded.value.filter((id) => id !== g.id)
    ElMessage.success(t('flows.groupDeleted'))
  } catch {
    /* 取消 */
  }
}

async function onDeleteFlow(f: FlowRecord, ev: Event) {
  ev.stopPropagation()
  if (f.locked) {
    ElMessage.warning(t('flows.lockedUnlockFirst'))
    return
  }
  try {
    await ElMessageBox.confirm(
      t('flows.deleteFlowConfirm', { name: f.name || f.id }),
      t('flows.deleteFlowTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
      },
    )
    await deleteFlow(f.id)
    removeLocal(f.id)
    emit('deleted', f.id)
    ElMessage.success(t('flows.deleted'))
  } catch {
    /* 取消 */
  }
}

/** 点击锁图标切换锁定；锁定可设密码，解锁时若有密码需校验 */
async function onToggleLock(f: FlowRecord, ev: Event) {
  ev.stopPropagation()
  try {
    let password = ''
    if (!f.locked) {
      // 锁定：可选密码（允许留空）
      try {
        const { value } = await ElMessageBox.prompt(
          t('flows.lockPasswordPrompt'),
          t('flows.lockTitle'),
          {
            confirmButtonText: t('flows.lockConfirmBtn'),
            cancelButtonText: t('common.cancel'),
            inputType: 'password',
            inputPlaceholder: t('common.optional'),
            inputValue: '',
            // 允许空密码
            inputValidator: () => true,
          },
        )
        password = value ?? ''
      } catch {
        return
      }
    } else if (f.hasLockPassword) {
      // 解锁且有密码：必须输入
      try {
        const { value } = await ElMessageBox.prompt(t('flows.unlockPasswordPrompt'), t('flows.unlockTitle'), {
          confirmButtonText: t('flows.unlockConfirmBtn'),
          cancelButtonText: t('common.cancel'),
          inputType: 'password',
          inputPlaceholder: t('flows.unlockPasswordPlaceholder'),
          inputValue: '',
        })
        password = value ?? ''
      } catch {
        return
      }
    }
    const updated = await setFlowLocked(f.id, !f.locked, password)
    upsert(updated)
    emit('locked', updated)
    ElMessage.success(updated.locked ? t('common.locked') : t('common.unlocked'))
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('flows.toggleLockFailed')
    ElMessage.error(msg)
  }
}

async function onMoveFlow(f: FlowRecord, groupId: string) {
  if ((f.groupId || '') === groupId) return
  try {
    const updated = await setFlowGroup(f.id, groupId)
    upsert(updated)
  } catch {
    ElMessage.error(t('flows.moveFailed'))
  }
}

/** 生成副本显示名：原名称 + 后缀（中文 _副本 / 英文 _copy） */
function copyDisplayName(f: FlowRecord) {
  const base = (f.name || f.id).trim() || f.id
  return `${base}${t('flows.copyNameSuffix')}`
}

/** 在当前分组创建副本 */
async function onDuplicateFlow(f: FlowRecord) {
  try {
    const created = await duplicateFlowAsCopy(f.id, copyDisplayName(f), f.groupId || '')
    upsert(created)
    ElMessage.success(t('flows.copyCreated'))
  } catch {
    ElMessage.error(t('flows.copyFailed'))
  }
}

/** 复制副本到指定分组（含未分组） */
async function onCopyFlowTo(f: FlowRecord, groupId: string) {
  try {
    const created = await duplicateFlowAsCopy(f.id, copyDisplayName(f), groupId)
    upsert(created)
    // 目标组未展开时展开，便于看到新副本
    const sectionId = groupId || UNGROUPED
    if (!expanded.value.includes(sectionId)) {
      expanded.value = [...expanded.value, sectionId]
    }
    ElMessage.success(t('flows.copyCreated'))
  } catch {
    ElMessage.error(t('flows.copyFailed'))
  }
}

defineExpose({ reload, upsert, hasFlow, removeLocal })
</script>

<template>
  <div class="flows">
    <div class="flows__head">
      <el-input
        v-model="keyword"
        size="small"
        :placeholder="t('flows.searchPlaceholder')"
        clearable
        :prefix-icon="Search"
      />
      <button
        class="flows__btn"
        type="button"
        :title="t('flows.expandAll')"
        @click="expandAll"
      >
        <el-icon><Expand /></el-icon>
      </button>
      <button
        class="flows__btn"
        type="button"
        :title="t('flows.collapseAll')"
        @click="collapseAll"
      >
        <el-icon><Fold /></el-icon>
      </button>
      <button class="flows__btn" type="button" :title="t('flows.refresh')" @click="reload">
        <el-icon><Refresh /></el-icon>
      </button>
      <el-dropdown trigger="click" @command="onPlusCommand">
        <button class="flows__btn" type="button" :title="t('flows.new')">
          <el-icon><Plus /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="flow">{{ t('flows.newFlow') }}</el-dropdown-item>
            <el-dropdown-item command="group">{{ t('flows.newGroup') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div v-if="loading" class="flows__hint">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="flows__hint is-error">
      {{ error }}
      <el-button link type="primary" size="small" @click="reload">{{ t('common.retry') }}</el-button>
    </div>
    <div v-else-if="!sections.some((s) => s.flows.length) && !groups.length" class="flows__hint">
      {{ keyword.trim() ? t('flows.emptyMatch') : t('flows.empty') }}
    </div>
    <el-collapse v-else v-model="expanded" class="flows__groups">
      <el-collapse-item v-for="sec in sections" :key="sec.id" :name="sec.id">
        <template #title>
          <div class="flows__ghead" @dblclick.stop="onRenameGroup(sec)">
            <span class="flows__gtitle" :title="sec.removable ? t('flows.dblclickRename') : ''">
              {{ sec.name }}
              <span class="flows__gcount">{{ sec.flows.length }}</span>
            </span>
            <button
              v-if="sec.removable"
              class="flows__x"
              type="button"
              :title="t('flows.deleteGroupTitle')"
              @click="onDeleteGroup(sec, $event)"
            >
              <el-icon :size="12"><Close /></el-icon>
            </button>
          </div>
        </template>
        <ul class="flows__list">
          <li
            v-for="f in sec.flows"
            :key="f.id"
            class="flows__item"
            :class="{
              'is-open': isOpen(f.id),
              'is-active': f.id === activeId,
              'is-locked': !!f.locked,
            }"
            :title="f.id"
            @click="emit('open', f)"
          >
            <span class="flows__dot" :class="{ 'is-open': isOpen(f.id) }" />
            <span class="flows__name">{{ f.name || f.id }}</span>
            <span
              v-if="!f.published"
              class="flows__badge"
              :title="t('flows.unpublished')"
              >{{ t('flows.unpublished') }}</span
            >
            <span
              v-else-if="f.unpublishedChanges"
              class="flows__badge is-changes"
              :title="t('flows.unpublishedChanges')"
              >{{ t('flows.unpublishedChanges') }}</span
            >
            <button
              class="flows__lock"
              type="button"
              :title="f.locked ? t('flows.unlock') : t('flows.lock')"
              @click="onToggleLock(f, $event)"
            >
              <el-icon :size="12">
                <Lock v-if="f.locked" />
                <Unlock v-else />
              </el-icon>
            </button>
            <FlowItemMoreMenu
              :flow="f"
              :groups="groups"
              @move="(gid) => onMoveFlow(f, gid)"
              @duplicate="onDuplicateFlow(f)"
              @copy-to="(gid) => onCopyFlowTo(f, gid)"
            />
            <button
              class="flows__x"
              type="button"
              :title="f.locked ? t('flows.lockedCannotDelete') : t('flows.deleteFlow')"
              :disabled="!!f.locked"
              @click="onDeleteFlow(f, $event)"
            >
              <el-icon :size="12"><Close /></el-icon>
            </button>
          </li>
          <li v-if="!sec.flows.length" class="flows__empty">{{ t('flows.emptyInGroup') }}</li>
        </ul>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.flows {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.flows__head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  position: sticky;
  top: 0;
  background: #f3f3f3;
  z-index: 1;
}
.flows__btn {
  width: 28px;
  height: 28px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  color: #555;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.flows__btn:hover {
  background: #eee;
  color: #222;
}
.flows__hint {
  padding: 8px 10px;
  font-size: 12px;
  color: #888;
}
.flows__hint.is-error {
  color: #c45656;
}
.flows__groups {
  border: none;
  /* 比节点分组略小 */
  --el-collapse-header-height: 24px;
}
.flows__groups :deep(.el-collapse-item__header) {
  padding: 0 6px 0 8px;
  font-size: 11px;
  background: transparent;
  border-bottom: none;
  color: #555;
  height: 24px;
  line-height: 24px;
}
.flows__groups :deep(.el-collapse-item__wrap) {
  border-bottom: none;
  background: transparent;
}
.flows__groups :deep(.el-collapse-item__content) {
  padding: 0;
}
.flows__ghead {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  padding-right: 4px;
}
.flows__gtitle {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  font-size: 11px;
}
.flows__gcount {
  margin-left: 4px;
  font-weight: 400;
  color: #999;
  font-size: 10px;
}
.flows__list {
  list-style: none;
  margin: 0;
  padding: 0 0 4px;
}
.flows__item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 4px 18px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  user-select: none;
}
.flows__item:hover {
  background: #e8e8e8;
}
.flows__item.is-active {
  background: #dde8f5;
}
.flows__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #bbb;
  flex-shrink: 0;
}
.flows__dot.is-open {
  background: #67c23a;
}
.flows__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.flows__badge {
  flex-shrink: 0;
  font-size: 10px;
  color: #94a3b8;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flows__badge.is-changes {
  color: #e6a23c;
}
.flows__lock {
  display: inline-flex;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: #bbb;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  opacity: 0;
}
.flows__item:hover .flows__lock,
.flows__item.is-locked .flows__lock {
  opacity: 1;
}
.flows__item.is-locked .flows__lock {
  color: #e6a23c;
}
.flows__lock:hover {
  color: #409eff;
  background: rgba(64, 158, 255, 0.12);
}
.flows__x {
  display: none;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: #999;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
}
.flows__item:hover .flows__x,
.flows__ghead:hover .flows__x {
  display: inline-flex;
}
.flows__x:hover:not(:disabled) {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.12);
}
.flows__x:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.flows__empty {
  padding: 4px 18px 8px;
  font-size: 11px;
  color: #aaa;
  list-style: none;
}
</style>
