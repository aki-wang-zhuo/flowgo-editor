<script setup lang="ts">
/**
 * 流程标签栏：切换 / 关闭 / 加号新建 / 双击改名。
 * 保存与刷新已移至画布右上角快捷栏。
 */
import { nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Close, Lock, Plus } from '@element-plus/icons-vue'
import type { EditorTab } from '@/workspace/useTabPool'

defineProps<{
  tabs: EditorTab[]
  activeId: string | null
}>()

const emit = defineEmits<{
  activate: [id: string]
  close: [id: string]
  create: []
  rename: [id: string, title: string]
}>()

const { t } = useI18n()

const renaming = reactive({ id: '', value: '' })
const renameRef = ref<{ focus: () => void; select?: () => void } | null>(null)

function startRename(tab: EditorTab) {
  if (tab.locked) return
  renaming.id = tab.id
  renaming.value = tab.title
  nextTick(() => {
    const el = renameRef.value as unknown as {
      focus: () => void
      select?: () => void
    }
    el?.focus?.()
    const input = document.querySelector(
      '.tabbar__rename-input input',
    ) as HTMLInputElement | null
    input?.select?.()
  })
}

function commitRename() {
  if (!renaming.id) return
  const name = renaming.value.trim()
  const id = renaming.id
  renaming.id = ''
  if (name) emit('rename', id, name)
}

function onDblClick(tab: EditorTab) {
  emit('activate', tab.id)
  startRename(tab)
}
</script>

<template>
  <div class="tabbar" role="tablist" :aria-label="t('tabBar.ariaLabel')">
    <div class="tabbar__strip">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tabbar__tab"
        :class="{
          'is-active': tab.id === activeId,
          'is-dirty': tab.dirty,
          'is-locked': !!tab.locked,
        }"
        role="tab"
        :aria-selected="tab.id === activeId"
        :title="
          tab.locked
            ? tab.title + t('tabBar.lockedSuffix')
            : tab.title + t('tabBar.renameHintSuffix')
        "
        @click="emit('activate', tab.id)"
        @dblclick.stop="onDblClick(tab)"
        @mousedown.middle.prevent="emit('close', tab.id)"
      >
        <el-icon v-if="tab.locked" class="tabbar__lock" :size="12"><Lock /></el-icon>
        <el-input
          v-if="renaming.id === tab.id"
          ref="renameRef"
          v-model="renaming.value"
          size="small"
          class="tabbar__rename-input"
          @keydown.enter.prevent="commitRename"
          @keydown.esc.prevent="renaming.id = ''"
          @blur="commitRename"
          @click.stop
        />
        <span v-else class="tabbar__title">{{ tab.title }}</span>
        <button
          class="tabbar__close"
          type="button"
          :aria-label="t('tabBar.closeAria', { title: tab.title })"
          @click.stop="emit('close', tab.id)"
        >
          <span v-if="tab.dirty" class="tabbar__dot" aria-hidden="true" />
          <el-icon class="tabbar__close-icon"><Close /></el-icon>
        </button>
      </div>

      <button
        class="tabbar__add"
        type="button"
        :title="t('tabBar.newFlow')"
        :aria-label="t('tabBar.newFlow')"
        @click="emit('create')"
      >
        <el-icon><Plus /></el-icon>
      </button>

      <div v-if="!tabs.length" class="tabbar__empty">
        {{ t('tabBar.emptyHint') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabbar {
  display: flex;
  align-items: stretch;
  height: 36px;
  background: #e8e8e8;
  border-bottom: 1px solid #ccc;
  flex-shrink: 0;
}
.tabbar__strip {
  display: flex;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  align-items: stretch;
}
.tabbar__tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 180px;
  padding: 0 8px 0 12px;
  border-right: 1px solid #ccc;
  background: #ddd;
  color: #444;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
}
.tabbar__tab:hover {
  background: #e4e4e4;
}
.tabbar__tab.is-active {
  background: #f3f3f3;
  color: #222;
  font-weight: 600;
}
.tabbar__lock {
  color: #e6a23c;
  flex-shrink: 0;
}
.tabbar__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.tabbar__rename-input {
  width: 110px;
}
.tabbar__rename-input :deep(.el-input__wrapper) {
  padding: 0 6px;
  box-shadow: 0 0 0 1px #409eff inset;
}
.tabbar__close {
  position: relative;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  border-radius: 3px;
  color: #666;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}
.tabbar__close:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #111;
}
.tabbar__close-icon {
  font-size: 12px;
  opacity: 0;
}
.tabbar__tab:hover .tabbar__close-icon,
.tabbar__tab.is-active .tabbar__close-icon {
  opacity: 1;
}
.tabbar__tab.is-dirty:not(:hover) .tabbar__close-icon {
  opacity: 0;
}
.tabbar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e6a23c;
  display: inline-block;
}
.tabbar__tab.is-dirty:hover .tabbar__dot,
.tabbar__tab.is-dirty.is-active:hover .tabbar__dot {
  display: none;
}
.tabbar__tab.is-dirty:not(:hover) .tabbar__close-icon {
  display: none;
}
.tabbar__add {
  width: 36px;
  flex-shrink: 0;
  border: none;
  border-right: 1px solid #ccc;
  background: transparent;
  color: #555;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.tabbar__add:hover {
  background: #ddd;
  color: #111;
}
.tabbar__empty {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  color: #888;
}
</style>
