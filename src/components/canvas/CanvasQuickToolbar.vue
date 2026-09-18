<script setup lang="ts">
/**
 * 画布右上角快捷栏：保存 / 上下线 / 发布菜单 / 刷新 / 自动布局 / 显示全部 / 控制台。
 * 图标统一使用项目 iconfont（非 Element Plus 图标）。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { LfInstance } from '@/canvas/lf-types'
import { layoutGraph } from '@/canvas/autoLayout'
import {
  consoleVisible,
  toggleConsole,
} from '@/console/useEditorConsole'
import { ToolbarIcons } from '@/assets/iconfont/toolbarIcons'
import IconfontIcon from '@/components/common/IconfontIcon.vue'

const props = withDefaults(
  defineProps<{
    lf?: LfInstance | null
    dirty?: boolean
    saving?: boolean
    refreshing?: boolean
    publishing?: boolean
    togglingOnline?: boolean
    showConsole?: boolean
    locked?: boolean
    published?: boolean
    unpublishedChanges?: boolean
    hasPublishHistory?: boolean
  }>(),
  {
    lf: null,
    dirty: false,
    saving: false,
    refreshing: false,
    publishing: false,
    togglingOnline: false,
    showConsole: true,
    locked: false,
    published: false,
    unpublishedChanges: false,
    hasPublishHistory: false,
  },
)

const { t } = useI18n()

const emit = defineEmits<{
  save: []
  refresh: []
  publish: []
  discard: []
  history: []
  online: []
  offline: []
  /** 自动布局后通知父级同步 DSL / dirty */
  graphChange: []
}>()

const busy = () =>
  props.saving || props.refreshing || props.publishing || props.togglingOnline

/** 未发布且无历史时不可上线；锁定时不可切换 */
const onlineBtnDisabled = computed(() => {
  if (props.locked || busy()) return true
  if (props.published) return false
  return !props.hasPublishHistory
})

const onlineTooltip = computed(() => {
  if (props.locked) return t('quickToolbar.onlineLocked')
  if (props.published) return t('quickToolbar.goOffline')
  if (!props.hasPublishHistory) return t('quickToolbar.onlineNeedHistory')
  return t('quickToolbar.goOnline')
})

/** 点击指示灯：已上线则下线，否则上线 */
function onOnlineClick() {
  if (onlineBtnDisabled.value) return
  if (props.published) emit('offline')
  else emit('online')
}

function fitAllNodes() {
  const lf = props.lf
  if (!lf?.fitView) return
  lf.fitView(40, 40)
}

/** 自动布局：有选中则只布选中区域，否则全量；完成后适应视口 */
function runAutoLayout() {
  if (!props.lf || props.locked) return
  const r = layoutGraph(props.lf)
  if (!r.ok) {
    ElMessage.warning(t('quickToolbar.autoLayoutFailed', { reason: r.reason || '' }))
    return
  }
  emit('graphChange')
  requestAnimationFrame(() => {
    props.lf?.fitView?.(40, 40)
  })
  const scope =
    r.scope === 'selection'
      ? t('quickToolbar.autoLayoutScopeSelection')
      : t('quickToolbar.autoLayoutScopeAll')
  ElMessage.success(
    t('quickToolbar.autoLayoutDone', { scope, count: r.nodeCount ?? 0 }),
  )
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
        circle
        :loading="saving"
        :disabled="busy() || locked"
        @click="emit('save')"
      >
        <IconfontIcon :name="ToolbarIcons.save" />
      </el-button>
    </el-tooltip>

    <el-tooltip :content="onlineTooltip" placement="bottom" :show-after="300">
      <el-button
        class="fg-quick-bar__btn"
        :class="{ 'is-online': published }"
        circle
        :loading="togglingOnline"
        :disabled="onlineBtnDisabled"
        @click="onOnlineClick"
      >
        <IconfontIcon
          :name="published ? ToolbarIcons.online : ToolbarIcons.offline"
        />
      </el-button>
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
          circle
          :loading="publishing"
          :disabled="busy()"
        >
          <IconfontIcon :name="ToolbarIcons.publish" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="publish" :disabled="locked">
              {{ t('quickToolbar.publish') }}
            </el-dropdown-item>
            <el-dropdown-item command="discard" :disabled="locked || !published">
              {{ t('quickToolbar.discard') }}
            </el-dropdown-item>
            <el-dropdown-item
              command="history"
              :disabled="!published && !hasPublishHistory"
              divided
            >
              {{ t('quickToolbar.history') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </el-tooltip>
    <el-tooltip :content="t('quickToolbar.refresh')" placement="bottom" :show-after="300">
      <el-button
        class="fg-quick-bar__btn"
        circle
        :loading="refreshing"
        :disabled="busy()"
        @click="emit('refresh')"
      >
        <IconfontIcon :name="ToolbarIcons.refresh" />
      </el-button>
    </el-tooltip>
    <el-tooltip
      :content="
        locked
          ? t('quickToolbar.autoLayoutLocked')
          : t('quickToolbar.autoLayout')
      "
      placement="bottom"
      :show-after="300"
    >
      <el-button
        class="fg-quick-bar__btn"
        circle
        :disabled="!lf || locked || busy()"
        @click="runAutoLayout"
      >
        <IconfontIcon :name="ToolbarIcons.autoLayout" />
      </el-button>
    </el-tooltip>
    <el-tooltip :content="t('quickToolbar.fitView')" placement="bottom" :show-after="300">
      <el-button
        class="fg-quick-bar__btn"
        circle
        :disabled="!lf"
        @click="fitAllNodes"
      >
        <IconfontIcon :name="ToolbarIcons.fitView" />
      </el-button>
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
        circle
        @click="toggleConsole()"
      >
        <IconfontIcon :name="ToolbarIcons.console" />
      </el-button>
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
  align-items: center;
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
.fg-quick-bar__btn :deep(.iconfont) {
  font-size: 16px;
  line-height: 1;
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
/** 已上线：指示灯高亮为绿色 */
.fg-quick-bar__btn.is-online {
  color: #67c23a;
}
.fg-quick-bar__btn.is-online:hover {
  color: #529b2e;
  background: #f0f9eb;
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
