<script setup lang="ts">
/**
 * 通用选中浮动操作栏（参照 RuleGo NodeHoverTools 视觉）。
 * 纯展示：由父级控制可见性、坐标与动作列表；不绑定 LogicFlow。
 */
import { computed, useTemplateRef } from 'vue'
import { Edit, Delete, VideoPlay, CaretRight, Switch } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { getActionTooltip, type SelectionActionKey } from './actionKeys'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    /** 是否显示 */
    visible: boolean
    /** 相对画布容器的 left（px） */
    x: number
    /** 相对画布容器的 top（px） */
    y: number
    /** 显示哪些按钮及顺序 */
    actions?: SelectionActionKey[]
    /** 顶部放不下时翻转到目标下方 */
    flipDown?: boolean
    /** 覆盖默认 tooltip */
    tooltips?: Partial<Record<SelectionActionKey, string>>
    /** 无障碍标签 */
    ariaLabel?: string
  }>(),
  {
    actions: () => ['edit', 'delete', 'run', 'runOnly'],
    flipDown: false,
  },
)

const { t } = useI18n()

const resolvedAriaLabel = computed(
  () => props.ariaLabel || t('selection.aria'),
)

const emit = defineEmits<{
  edit: []
  delete: []
  run: []
  runOnly: []
  pickPath: []
}>()

const barRef = useTemplateRef<HTMLElement>('barRef')

const ICON_MAP: Record<SelectionActionKey, Component> = {
  edit: Edit,
  delete: Delete,
  run: VideoPlay,
  runOnly: CaretRight,
  pickPath: Switch,
}

const TONE_CLASS: Partial<Record<SelectionActionKey, string>> = {
  delete: 'fg-action-bar__btn--danger',
  run: 'fg-action-bar__btn--primary',
  runOnly: 'fg-action-bar__btn--warning',
  pickPath: 'fg-action-bar__btn--accent',
}

const visibleActions = computed(() => props.actions || [])

function tip(key: SelectionActionKey): string {
  return props.tooltips?.[key] || getActionTooltip(key)
}

function onClick(key: SelectionActionKey) {
  if (key === 'edit') emit('edit')
  else if (key === 'delete') emit('delete')
  else if (key === 'run') emit('run')
  else if (key === 'runOnly') emit('runOnly')
  else if (key === 'pickPath') emit('pickPath')
}

/** 供定位逻辑读取实测宽高 */
defineExpose({
  el: barRef,
  getSize: () => ({
    width: barRef.value?.offsetWidth || 0,
    height: barRef.value?.offsetHeight || 0,
  }),
})
</script>

<template>
  <div
    v-if="visible"
    ref="barRef"
    class="fg-action-bar"
    :class="{ 'fg-action-bar--flip': flipDown }"
    :style="{ left: `${x}px`, top: `${y}px` }"
    role="toolbar"
    :aria-label="resolvedAriaLabel"
    @mousedown.stop
    @click.stop
  >
    <el-tooltip
      v-for="key in visibleActions"
      :key="key"
      :content="tip(key)"
      placement="top"
      :show-after="400"
    >
      <el-button
        class="fg-action-bar__btn"
        :class="TONE_CLASS[key]"
        :type="key === 'delete' ? 'danger' : key === 'run' ? 'primary' : key === 'runOnly' ? 'warning' : 'default'"
        :icon="ICON_MAP[key]"
        circle
        :aria-label="tip(key)"
        @click="onClick(key)"
      />
    </el-tooltip>
  </div>
</template>

<style scoped>
.fg-action-bar {
  position: absolute;
  z-index: 12;
  display: flex;
  gap: 2px;
  align-items: center;
  padding: 3px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform-origin: center bottom;
  animation: fg-action-pop 120ms ease-out;
  pointer-events: auto;
}
.fg-action-bar--flip {
  transform-origin: center top;
  animation-name: fg-action-pop-flip;
}
.fg-action-bar :deep(.el-button.is-circle) {
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}
.fg-action-bar :deep(.el-button + .el-button) {
  margin-left: 0;
}
.fg-action-bar :deep(.el-button.is-circle:hover) {
  background: #f3f4f6;
}
.fg-action-bar :deep(.el-button.is-circle:focus-visible) {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}
.fg-action-bar :deep(.fg-action-bar__btn--danger .el-icon),
.fg-action-bar :deep(.fg-action-bar__btn--danger svg) {
  color: var(--el-color-danger, #f56c6c);
}
.fg-action-bar :deep(.fg-action-bar__btn--primary .el-icon),
.fg-action-bar :deep(.fg-action-bar__btn--primary svg) {
  color: var(--el-color-primary, #409eff);
}
.fg-action-bar :deep(.fg-action-bar__btn--warning .el-icon),
.fg-action-bar :deep(.fg-action-bar__btn--warning svg) {
  color: var(--el-color-warning, #e6a23c);
}
.fg-action-bar :deep(.fg-action-bar__btn--accent .el-icon),
.fg-action-bar :deep(.fg-action-bar__btn--accent svg) {
  color: #7c3aed;
}
@keyframes fg-action-pop {
  from {
    opacity: 0;
    transform: translateY(2px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes fg-action-pop-flip {
  from {
    opacity: 0;
    transform: translateY(-2px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
