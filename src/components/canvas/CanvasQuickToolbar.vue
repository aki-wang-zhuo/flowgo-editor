<script setup lang="ts">
/**
 * 画布右上角悬浮快捷栏：保存 / 刷新 / 显示全部 / 控制台。
 * 仅作用于当前画布所在流程。
 */
import { useI18n } from 'vue-i18n'
import {
  DocumentChecked,
  FullScreen,
  Monitor,
  Refresh,
} from '@element-plus/icons-vue'
import type { LfInstance } from '@/canvas/lf-types'
import {
  consoleVisible,
  toggleConsole,
} from '@/console/useEditorConsole'

const props = withDefaults(
  defineProps<{
    lf?: LfInstance | null
    /** 当前流程是否有未保存更改 */
    dirty?: boolean
    saving?: boolean
    refreshing?: boolean
    showConsole?: boolean
    /** 锁定时禁用保存 */
    locked?: boolean
  }>(),
  {
    lf: null,
    dirty: false,
    saving: false,
    refreshing: false,
    showConsole: true,
    locked: false,
  },
)

const { t } = useI18n()

const emit = defineEmits<{
  save: []
  refresh: []
}>()

/** 缩放并平移，使画布中全部节点可见 */
function fitAllNodes() {
  const lf = props.lf
  if (!lf?.fitView) return
  lf.fitView(40, 40)
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
        :disabled="saving || refreshing || locked"
        @click="emit('save')"
      />
    </el-tooltip>
    <el-tooltip
      :content="t('quickToolbar.refresh')"
      placement="bottom"
      :show-after="300"
    >
      <el-button
        class="fg-quick-bar__btn"
        :icon="Refresh"
        circle
        :loading="refreshing"
        :disabled="saving || refreshing"
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
.fg-quick-bar__btn.is-dirty {
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
</style>
