<script setup lang="ts">
/**
 * LogicFlow 画布容器：初始化、渲染 DSL、选中工具、快捷栏与运行分发。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLogicFlow } from '@/canvas/useLogicFlow'
import { useAltSelectionSelect } from '@/canvas/useAltSelectionSelect'
import { useEdgeAdjustOnDblClick } from '@/canvas/useEdgeAdjustOnDblClick'
import { bindHttpEndpointEdgeRules } from '@/canvas/useHttpEndpointEdges'
import { bindBranchEdgeRules } from '@/canvas/useBranchEdges'
import { bindJsTransformEdgeRules } from '@/canvas/useJsTransformEdges'
import { bindEdgeDirectionNormalize } from '@/canvas/useEdgeDirection'
import { bindInsertNodeOnEdge } from '@/canvas/useInsertNodeOnEdge'
import { bindSuppressSpuriousBlankClick } from '@/canvas/suppressSpuriousBlankClick'
import { dslToGraph, type LfGraphData } from '@/canvas/adapter'
import type { LfInstance } from '@/canvas/lf-types'
import type { FlowDSL } from '@/types/flow'
import {
  NodeSelectionTools,
  EdgeSelectionTools,
} from '@/components/selection-tools'
import CanvasQuickToolbar from '@/components/canvas/CanvasQuickToolbar.vue'
import CanvasMiniMap from '@/components/canvas/CanvasMiniMap.vue'
import RunErrorBubble from '@/components/canvas/RunErrorBubble.vue'
import { ensureRunnersRegistered, runEdge, runNode } from '@/run/dispatch'

const props = defineProps<{
  /** 当前流程 DSL；变化时重新渲染（保存元信息变更除外由父级控制） */
  dsl: FlowDSL | null
  dirty?: boolean
  saving?: boolean
  refreshing?: boolean
  /** 流程锁定：画布静默模式，禁止编辑 */
  locked?: boolean
  publishing?: boolean
  published?: boolean
  unpublishedChanges?: boolean
}>()

const emit = defineEmits<{
  ready: [lf: LfInstance]
  selectNode: [nodeId: string | null]
  selectEdge: [edgeId: string | null]
  graphChange: []
  save: []
  refresh: []
  publish: []
  discard: []
  history: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const minimapRef = ref<InstanceType<typeof CanvasMiniMap> | null>(null)
const { lf, init } = useLogicFlow(containerRef)
/** 按住 Alt + 左键拖拽框选 */
useAltSelectionSelect(lf)
/** 双击连线才显示贝塞尔调节手柄 */
useEdgeAdjustOnDblClick(lf)

/** 方向归一 / HTTP / 分支 / JS双出口 / 拖入插入 / 跨界松开 的卸载函数 */
let disposeEdgeDir: (() => void) | undefined
let disposeHttpEdges: (() => void) | undefined
let disposeBranchEdges: (() => void) | undefined
let disposeJsEdges: (() => void) | undefined
let disposeInsertOnEdge: (() => void) | undefined
let disposeSpuriousBlank: (() => void) | undefined

onMounted(() => {
  ensureRunnersRegistered()
  init()
  if (!lf.value) return
  bindEvents(lf.value)
  // 方向归一须最先注册，保证后续 edge:add 处理器看到出→入的边
  disposeEdgeDir = bindEdgeDirectionNormalize(lf.value)
  disposeHttpEdges = bindHttpEndpointEdgeRules(lf.value)
  disposeBranchEdges = bindBranchEdgeRules(lf.value)
  disposeJsEdges = bindJsTransformEdgeRules(lf.value)
  disposeInsertOnEdge = bindInsertNodeOnEdge(lf.value)
  disposeSpuriousBlank = bindSuppressSpuriousBlankClick(containerRef.value)
  emit('ready', lf.value)
  applyLockMode(!!props.locked)
  if (props.dsl) {
    renderDsl(props.dsl)
  }
  requestAnimationFrame(() => lf.value?.resize?.())
})

onBeforeUnmount(() => {
  disposeEdgeDir?.()
  disposeEdgeDir = undefined
  disposeHttpEdges?.()
  disposeHttpEdges = undefined
  disposeBranchEdges?.()
  disposeBranchEdges = undefined
  disposeJsEdges?.()
  disposeJsEdges = undefined
  disposeInsertOnEdge?.()
  disposeInsertOnEdge = undefined
  disposeSpuriousBlank?.()
  disposeSpuriousBlank = undefined
})

watch(
  () => props.dsl?.id,
  () => {
    if (lf.value && props.dsl) {
      renderDsl(props.dsl)
    }
  },
)

/** 锁定时进入 LogicFlow 静默模式（不可拖节点/连线/删除） */
watch(
  () => props.locked,
  (locked) => {
    applyLockMode(!!locked)
  },
)

function applyLockMode(locked: boolean) {
  const instance = lf.value
  if (!instance?.updateEditConfig) return
  instance.updateEditConfig({ isSilentMode: locked })
  // 静默模式默认 stopScrollGraph=false（滚轮变平移）；恢复为滚轮缩放
  if (locked) {
    instance.updateEditConfig({
      stopScrollGraph: true,
      stopZoomGraph: false,
    })
  }
}

function bindEvents(instance: LfInstance) {
  instance.on('node:click', ({ data }: { data: { id: string } }) => {
    emit('selectNode', data.id)
    emit('selectEdge', null)
  })
  instance.on('edge:click', ({ data }: { data: { id: string } }) => {
    emit('selectEdge', data.id)
    emit('selectNode', null)
  })
  instance.on('blank:click', () => {
    emit('selectNode', null)
    emit('selectEdge', null)
  })
  ;['node:drop', 'node:dnd-add', 'node:delete', 'edge:add', 'edge:delete', 'edge:adjust', 'node:drag'].forEach(
    (evt) => {
      instance.on(evt, () => emit('graphChange'))
    },
  )
}

function onNodeToolsEdit(nodeId: string) {
  emit('selectNode', nodeId)
  emit('selectEdge', null)
}

function onEdgeToolsEdit(payload: { edgeId: string; sourceNodeId: string }) {
  emit('selectNode', payload.sourceNodeId)
  emit('selectEdge', null)
}

function onToolsDelete() {
  emit('graphChange')
}

function flowMeta() {
  return {
    flowId: props.dsl?.id || '',
    flowName: props.dsl?.name || '',
    entryNode: props.dsl?.entryNode || '',
  }
}

async function onEdgeRun(edgeId: string) {
  if (!lf.value || !props.dsl?.id) return
  const meta = flowMeta()
  await runEdge({
    lf: lf.value,
    edgeId,
    ...meta,
  })
}

async function onNodeRun(nodeId: string) {
  if (!lf.value || !props.dsl?.id) return
  const meta = flowMeta()
  await runNode({
    lf: lf.value,
    nodeId,
    mode: 'run',
    ...meta,
  })
}

async function onNodeRunOnly(nodeId: string) {
  if (!lf.value || !props.dsl?.id) return
  const meta = flowMeta()
  await runNode({
    lf: lf.value,
    nodeId,
    mode: 'runOnly',
    ...meta,
  })
}

function renderDsl(dsl: FlowDSL) {
  if (!lf.value) return
  const graph = dslToGraph(dsl)
  lf.value.render(graph as unknown as Record<string, unknown>)
  // 打开/切换流程后默认缩放到全部节点可见
  fitAllAfterRender()
  // render 不一定走 history，主动刷新已展开的小地图
  requestAnimationFrame(() => minimapRef.value?.refresh?.())
}

/** 等容器尺寸就绪后再 fitView，避免首帧宽高为 0 */
function fitAllAfterRender() {
  const instance = lf.value
  if (!instance?.fitView) return
  requestAnimationFrame(() => {
    instance.resize?.()
    requestAnimationFrame(() => {
      if (!lf.value) return
      const nodes = (lf.value.getGraphData?.() as { nodes?: unknown[] })?.nodes
      if (!nodes?.length) return
      lf.value.fitView(40, 40)
    })
  })
}

function getGraphData(): LfGraphData {
  if (!lf.value) return { nodes: [], edges: [] }
  return lf.value.getGraphData() as unknown as LfGraphData
}

defineExpose({ getGraphData, lf })
</script>

<template>
  <div class="canvas-wrap">
    <div ref="containerRef" class="canvas" />
    <CanvasQuickToolbar
      :lf="lf"
      :dirty="dirty"
      :saving="saving"
      :refreshing="refreshing"
      :publishing="publishing"
      :locked="locked"
      :published="published"
      :unpublished-changes="unpublishedChanges"
      @save="emit('save')"
      @refresh="emit('refresh')"
      @publish="emit('publish')"
      @discard="emit('discard')"
      @history="emit('history')"
      @graph-change="emit('graphChange')"
    />
    <CanvasMiniMap ref="minimapRef" :lf="lf" />
    <RunErrorBubble :lf="lf" />
    <NodeSelectionTools
      v-if="lf"
      :lf="lf"
      :locked="locked"
      @edit="onNodeToolsEdit"
      @delete="onToolsDelete"
      @run="onNodeRun"
      @run-only="onNodeRunOnly"
    />
    <EdgeSelectionTools
      v-if="lf"
      :lf="lf"
      :locked="locked"
      @edit="onEdgeToolsEdit"
      @delete="onToolsDelete"
      @run="onEdgeRun"
      @change="onToolsDelete"
    />
  </div>
</template>

<style scoped>
.canvas-wrap {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  background: #f8fafc;
}
.canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.canvas-wrap:has(.lf-selection-select) {
  cursor: crosshair;
}

/* 右下角小地图：标题栏 + 关闭；预览框可拖拽导航 */
.canvas-wrap :deep(.lf-mini-map) {
  z-index: 12;
  padding: 6px;
  padding-top: 28px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}
.canvas-wrap :deep(.lf-mini-map-header) {
  margin: 4px 28px 4px 6px;
  font-size: 12px;
  line-height: 18px;
  color: #64748b;
  user-select: none;
}
.canvas-wrap :deep(.lf-mini-map-close) {
  top: 6px;
  right: 6px;
  width: 16px;
  height: 16px;
  opacity: 0.55;
}
.canvas-wrap :deep(.lf-mini-map-close:hover) {
  opacity: 1;
}
.canvas-wrap :deep(.lf-minimap-viewport) {
  background-color: rgba(37, 99, 235, 0.16);
  border: 1px solid rgba(37, 99, 235, 0.55);
  border-radius: 2px;
  cursor: grab;
}
.canvas-wrap :deep(.lf-minimap-viewport:active) {
  cursor: grabbing;
}
</style>
