<script setup lang="ts">
/**
 * 画布右上角快捷栏：保存草稿 / 发布菜单 / 刷新 / 显示全部 / 控制台。
 * 发布相关（发布、放弃草稿、发布历史）收在同一下拉菜单。
 */
import { useI18n } from 'vue-i18n'
import {
  DocumentChecked,
  FullScreen,
  Monitor,
  Refresh,
  Upload,
} from '@element-plus/icons-vue'
import type { LfInstance } from '@/canvas/lf-types'
import {
  consoleVisible,
  toggleConsole,
} from '@/console/useEditorConsole'

const props = withDefaults(
  defineProps<{
    lf?: LfInstance | null
    dirty?: boolean
    saving?: boolean
    refreshing?: boolean
    publishing?: boolean
    showConsole?: boolean
    locked?: boolean
    published?: boolean
    unpublishedChanges?: boolean
  }>(),
  {
    lf: null,
    dirty: false,
    saving: false,
    refreshing: false,
    publishing: false,
    showConsole: true,
    locked: false,
    published: false,
    unpublishedChanges: false,
  },
)

const { t } = useI18n()

const emit = defineEmits<{
  save: []
  refresh: []
  publish: []
  discard: []
  history: []
}>()

const busy = () => props.saving || props.refreshing || props.publishing

function fitAllNodes() {
  const lf = props.lf
  if (!lf?.fitView) return
  lf.fitView(40, 40)
}

function onPublishCommand(cmd: string) {
  if (cmd === 'publish') emit('publish')
  else if (cmd === 'discard') emit('discard')
  else if (cmd === 'history') emit('history')
}
</script>

<template>
  <div class="fg-quick-bar" role="toolbar" :aria-label="t('quickToolbar.aria')">
    <el-tooltip
      :content="
        locked
          ? t('quickToolbar.saveLocked')
          : dirty
            ? t('quickToolbar.saveDirty')
            : t('quickToolbar.save')
      "
      placement="bottom"
      :show-after="300"
    >
      <el-button
        class="fg-quick-bar__btn"
        :class="{ 'is-dirty': dirty && !locked }"
        :icon="DocumentChecked"
        circle
        :loading="saving"
        :disabled="busy() || locked"
        @click="emit('save')"
      />
    </el-tooltip>
    <el-tooltip
      :content="
        locked
          ? t('quickToolbar.publishLocked')
          : t('quickToolbar.publishMenu')
      "
      placement="bottom"
      :show-after="300"
    >
      <el-dropdown
        trigger="click"
        :disabled="busy()"
        @command="onPublishCommand"
      >
        <el-button
          class="fg-quick-bar__btn"
          :class="{ 'is-publish': unpublishedChanges || !published }"
          :icon="Upload"
          circle
          :loading="publishing"
          :disabled="busy()"
        />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="publish" :disabled="locked">
              {{ t('quickToolbar.publish') }}
            </el-dropdown-item>
            <el-dropdown-item command="discard" :disabled="locked || !published">
              {{ t('quickToolbar.discard') }}
            </el-dropdown-item>
            <el-dropdown-item command="history" :disabled="!published" divided>
              {{ t('quickToolbar.history') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </el-tooltip>
    <el-tooltip :content="t('quickToolbar.refresh')" placement="bottom" :show-after="300">
      <el-button
        class="fg-quick-bar__btn"
        :icon="Refresh"
        circle
        :loading="refreshing"
        :disabled="busy()"
        @click="emit('refresh')"
      />
    </el-tooltip>
    <el-tooltip :content="t('quickToolbar.fitView')" placement="bottom" :show-after="300">
      <el-button
        class="fg-quick-bar__btn"
        :icon="FullScreen"
        circle
        :disabled="!lf"
        @click="fitAllNodes"
      />
    </el-tooltip>
    <el-tooltip
      v-if="showConsole"
      :content="consoleVisible ? t('quickToolbar.hideConsole') : t('quickToolbar.showConsole')"
      placement="bottom"
      :show-after="300"
    >
      <el-button
        class="fg-quick-bar__btn"
        :class="{ 'is-active': consoleVisible }"
        :icon="Monitor"
        circle
        @click="toggleConsole()"
      />
    </el-tooltip>
  </div>
</template>

<style scoped>
.fg-quick-bar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 15;
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}
.fg-quick-bar__btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
}
.fg-quick-bar__btn:hover,
.fg-quick-bar__btn.is-active {
  background: #f1f5f9;
  color: #2563eb;
}
.fg-quick-bar__btn.is-dirty,
.fg-quick-bar__btn.is-publish {
  color: #e6a23c;
}
.fg-quick-bar__btn.is-disabled,
.fg-quick-bar__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.fg-quick-bar :deep(.el-button + .el-button) {
  margin-left: 0;
}
.fg-quick-bar :deep(.el-dropdown) {
  display: inline-flex;
}
</style>
