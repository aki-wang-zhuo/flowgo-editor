<script setup lang="ts">
/**
 * 单个流程 Tab 的画布实例（v-show 保活，切换不销毁）。
 * 底部挂载编辑器控制台。
 */
import { ref, watch } from 'vue'
import type { FlowDSL } from '@/types/flow'
import type { LfInstance } from '@/canvas/lf-types'
import type { LfGraphData } from '@/canvas/adapter'
import {
  consoleHeight,
  consoleVisible,
} from '@/console/useEditorConsole'
import FlowCanvas from './FlowCanvas.vue'
import EditorConsole from '@/components/console/EditorConsole.vue'

const props = defineProps<{
  tabId: string
  dsl: FlowDSL
  active: boolean
  dirty?: boolean
  saving?: boolean
  refreshing?: boolean
  locked?: boolean
  publishing?: boolean
  published?: boolean
  unpublishedChanges?: boolean
}>()

const emit = defineEmits<{
  ready: [tabId: string, lf: LfInstance]
  selectNode: [tabId: string, nodeId: string | null]
  graphChange: [tabId: string]
  save: [tabId: string]
  refresh: [tabId: string]
  publish: [tabId: string]
  discard: [tabId: string]
  history: [tabId: string]
}>()

const canvasRef = ref<InstanceType<typeof FlowCanvas> | null>(null)
const lfLocal = ref<LfInstance | null>(null)
const selectedNodeId = ref<string | null>(null)

function onReady(lf: LfInstance) {
  lfLocal.value = lf
  emit('ready', props.tabId, lf)
}

function onSelect(id: string | null) {
  selectedNodeId.value = id
  emit('selectNode', props.tabId, id)
}

function onGraphChange() {
  emit('graphChange', props.tabId)
}

/** 控制台显隐/高度变化后刷新画布尺寸（拖拽时按帧节流） */
let resizeRaf = 0
function scheduleLfResize() {
  if (!props.active) return
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0
    lfLocal.value?.resize?.()
  })
}

watch(
  () => props.active,
  (v) => {
    if (v) scheduleLfResize()
  },
)

watch([consoleVisible, consoleHeight], () => {
  scheduleLfResize()
})

function getGraphData(): LfGraphData {
  return canvasRef.value?.getGraphData() || { nodes: [], edges: [] }
}

defineExpose({
  getGraphData,
  lf: lfLocal,
  selectedNodeId,
})
</script>

<template>
  <div class="pane" v-show="active">
    <div class="pane__canvas">
      <FlowCanvas
        ref="canvasRef"
        :dsl="dsl"
        :dirty="dirty"
        :saving="saving"
        :refreshing="refreshing"
        :locked="locked"
        :publishing="publishing"
        :published="published"
        :unpublished-changes="unpublishedChanges"
        @ready="onReady"
        @select-node="onSelect"
        @graph-change="onGraphChange"
        @save="emit('save', tabId)"
        @refresh="emit('refresh', tabId)"
        @publish="emit('publish', tabId)"
        @discard="emit('discard', tabId)"
        @history="emit('history', tabId)"
      />
    </div>
    <EditorConsole />
  </div>
</template>

<style scoped>
.pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.pane__canvas {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}
</style>
