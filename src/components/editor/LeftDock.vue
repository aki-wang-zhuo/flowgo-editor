<script setup lang="ts">
/**
 * 左侧 Dock：上方「我的流程」，下方「节点」分组（可折叠面板）。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LfInstance } from '@/canvas/lf-types'
import type { FlowRecord } from '@/api/flow'
import FlowsPanel from './FlowsPanel.vue'
import NodePalette from './NodePalette.vue'

defineProps<{
  lf: LfInstance | null
  openIds: string[]
  activeId: string | null
  /** 当前激活流程是否锁定（锁定时禁止从面板拖入节点） */
  canvasLocked?: boolean
  /** 面板宽度（由工作区拖拽控制） */
  width: number
}>()

const emit = defineEmits<{
  openFlow: [flow: FlowRecord]
  createFlow: []
  deletedFlow: [flowId: string]
  trashedFlow: [flowId: string]
  lockedFlow: [flow: FlowRecord]
}>()

/** 两个主区块的展开态 */
const { t } = useI18n()

const sections = ref(['flows', 'nodes'])
const flowsRef = ref<InstanceType<typeof FlowsPanel> | null>(null)
const paletteRef = ref<InstanceType<typeof NodePalette> | null>(null)

defineExpose({
  reloadFlows: () => flowsRef.value?.reload(),
  upsertFlow: (rec: FlowRecord) => flowsRef.value?.upsert(rec),
  hasFlow: (id: string) => flowsRef.value?.hasFlow(id) ?? false,
  removeFlow: (id: string) => flowsRef.value?.removeLocal(id),
  reloadPalette: () => paletteRef.value?.reload(),
})
</script>

<template>
  <aside class="dock" :style="{ width: `${width}px` }">
    <div class="dock__scroll">
      <el-collapse v-model="sections" class="dock__sections">
        <el-collapse-item name="flows" class="dock__block--flows">
          <template #title>
            <span class="dock__title">{{ t('leftDock.flows') }}</span>
          </template>
          <FlowsPanel
            ref="flowsRef"
            :open-ids="openIds"
            :active-id="activeId"
            @open="emit('openFlow', $event)"
            @create="emit('createFlow')"
            @deleted="emit('deletedFlow', $event)"
            @trashed="emit('trashedFlow', $event)"
            @locked="emit('lockedFlow', $event)"
          />
        </el-collapse-item>
        <el-collapse-item name="nodes" class="dock__block--nodes">
          <template #title>
            <span class="dock__title">{{ t('leftDock.nodes') }}</span>
          </template>
          <NodePalette ref="paletteRef" :lf="lf" :disabled="canvasLocked" />
        </el-collapse-item>
      </el-collapse>
    </div>
  </aside>
</template>

<style scoped>
.dock {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #f3f3f3;
}
.dock__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.dock__sections {
  border: none;
  --el-collapse-header-height: 30px;
}
.dock__sections :deep(.el-collapse-item__header) {
  padding: 0 8px;
  font-size: 12px;
  background: #eaeaea;
  border-bottom: 1px solid #ddd;
  color: #444;
}
.dock__sections :deep(.el-collapse-item__wrap) {
  border-bottom: 1px solid #ddd;
  background: #f3f3f3;
}
/* 只清两大区块自身 content 的默认内边距，勿波及内部「转换」等嵌套折叠 */
:deep(.dock__block--flows > .el-collapse-item__wrap > .el-collapse-item__content),
:deep(.dock__block--nodes > .el-collapse-item__wrap > .el-collapse-item__content) {
  padding: 0;
}
.dock__title {
  font-weight: 600;
}

/* 仅区分两大区块底色（其余与初版一致） */
:deep(.dock__block--flows > .el-collapse-item__header) {
  background: #d9e6f5;
}
:deep(.dock__block--nodes > .el-collapse-item__header) {
  background: #efe6da;
}
</style>
