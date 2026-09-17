<script setup lang="ts">
/**
 * 连线悬停浮动操作栏（与节点栏共用互斥状态，同一时刻只显示一个）。
 * HTTP 出边：删除 / 运行 / 编辑调试值 / 重新选择路径（唯一带连线运行的边）。
 * 分支出边：删除 / 编辑源节点 / 重新选择分支。
 * 注入出边：删除 / 编辑（运行在节点栏）。
 * JS 转换（仅 1 条出边）：删除 / 编辑 / 切换 Success·Failure。
 * 其它连线：删除 / 编辑（打开源节点属性）。
 */
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LfInstance } from '@/canvas/lf-types'
import {
  readRouters,
  routerLabel,
  routerRelation,
} from '@/canvas/httpRouter'
import { rebindHttpEdgePath } from '@/canvas/useHttpEndpointEdges'
import { rebindBranchEdgeRelation } from '@/canvas/useBranchEdges'
import {
  canRebindJsEdgeRelation,
  rebindJsEdgeRelation,
} from '@/canvas/useJsTransformEdges'
import { useHoverTools } from '@/canvas/useHoverTools'
import HttpRouterDebugDialog from '@/components/editor/HttpRouterDebugDialog.vue'
import SelectionActionBar from './SelectionActionBar.vue'
import {
  EDGE_BRANCH_ACTIONS,
  EDGE_HTTP_ACTIONS,
  EDGE_INJECT_ACTIONS,
  EDGE_JS_SINGLE_ACTIONS,
  EDGE_PATH_ACTIONS,
  type SelectionActionKey,
} from './actionKeys'

const props = withDefaults(
  defineProps<{
    lf: LfInstance | null
    /** 覆盖默认按钮集合（仍会按是否 HTTP 出边裁剪 pickPath） */
    actions?: SelectionActionKey[]
    /** 流程锁定时仅保留运行 */
    locked?: boolean
  }>(),
  {
    actions: undefined,
    locked: false,
  },
)

const emit = defineEmits<{
  /** 非 HTTP：打开源节点属性 */
  edit: [payload: { edgeId: string; sourceNodeId: string }]
  delete: [edgeId: string]
  run: [edgeId: string]
  /** 调试值 / 重选路径后通知画布脏标记 */
  change: []
}>()

const { t } = useI18n()

const EDGE_PADDING = 4
const GAP = 8

const barRef = useTemplateRef<InstanceType<typeof SelectionActionBar>>('barRef')

const debugOpen = ref(false)
const debugTitle = ref('')
const debugSeed = ref('{}')
const debugEdgeId = ref('')
const debugSourceId = ref('')
const debugRouterIndex = ref(-1)

const {
  visible,
  pos,
  targetId,
  flipDown,
  setPlaceAt,
  setGetModel,
  watchLf,
  onToolbarEnter,
  onToolbarLeave,
} = useHoverTools({
  kind: 'edge',
  existsInGraph: (lf, id) => !!lf?.graphModel?.getEdgeModelById?.(id),
})

setGetModel((lf, id) => lf?.graphModel?.getEdgeModelById?.(id))

setPlaceAt((edgeModel, graphModel, lf) => {
  const model = edgeModel as {
    getTextPosition?: () => { x: number; y: number }
    textPosition?: { x: number; y: number }
  }
  const p = model.getTextPosition?.() || model.textPosition
  if (!p) return null
  const gm = graphModel as {
    transformModel?: {
      CanvasPointToHtmlPoint: (pt: number[]) => number[]
    }
  }
  const tm = gm?.transformModel
  if (!tm?.CanvasPointToHtmlPoint) return null
  const [hx, hy] = tm.CanvasPointToHtmlPoint([p.x, p.y])

  const size = barRef.value?.getSize?.() || { width: 0, height: 0 }
  const tw = size.width || 120
  const th = size.height || 32
  const canvasW = lf.container?.clientWidth || 0

  let x = hx - tw / 2
  let y = hy - GAP - th
  let flip = false
  if (y < EDGE_PADDING) {
    y = hy + GAP
    flip = true
  }
  if (canvasW > 0) {
    x = Math.max(EDGE_PADDING, Math.min(x, canvasW - tw - EDGE_PADDING))
  }
  return { x, y, flipDown: flip }
})

watchLf(() => props.lf)

function currentEdge(): {
  id: string
  sourceNodeId: string
  properties?: Record<string, unknown>
} | null {
  const id = targetId.value
  if (!id || !props.lf) return null
  const model = props.lf.getEdgeModelById?.(id) as
    | {
        id: string
        sourceNodeId: string
        properties?: Record<string, unknown>
      }
    | undefined
  if (!model) return null
  return model
}

/** 当前悬停边是否来自 HTTP 入口 */
const isHttpEdge = computed(() => {
  const edge = currentEdge()
  if (!edge || !props.lf) return false
  const source = props.lf.getNodeModelById?.(edge.sourceNodeId)
  return source?.type === 'httpEndpoint'
})

/** 当前悬停边是否来自注入执行 */
const isInjectEdge = computed(() => {
  const edge = currentEdge()
  if (!edge || !props.lf) return false
  const source = props.lf.getNodeModelById?.(edge.sourceNodeId)
  return source?.type === 'inject'
})

/** 当前悬停边是否来自 IF / SWITCH 分支 */
const isBranchEdge = computed(() => {
  const edge = currentEdge()
  if (!edge || !props.lf) return false
  const source = props.lf.getNodeModelById?.(edge.sourceNodeId)
  return source?.type === 'if' || source?.type === 'switch'
})

/** JS 转换出边，且当前仅 1 条出边时可切换 Success/Failure */
const isJsSingleEdge = computed(() => {
  const edge = currentEdge()
  if (!edge || !props.lf) return false
  return canRebindJsEdgeRelation(props.lf, edge.id)
})

const actions = computed(() => {
  let list: SelectionActionKey[]
  if (props.actions) list = props.actions
  else if (isHttpEdge.value) list = [...EDGE_HTTP_ACTIONS]
  else if (isInjectEdge.value) list = [...EDGE_INJECT_ACTIONS]
  else if (isBranchEdge.value) list = [...EDGE_BRANCH_ACTIONS]
  else if (isJsSingleEdge.value) list = [...EDGE_JS_SINGLE_ACTIONS]
  else list = [...EDGE_PATH_ACTIONS]
  if (!props.locked) return list
  return list.filter((a) => a === 'run')
})

const tooltips = computed(() => {
  if (isHttpEdge.value) {
    return {
      delete: t('selection.edgeDelete'),
      run: t('selection.run'),
      edit: t('selection.edgeEditDebug'),
      pickPath: t('selection.edgeReselectPath'),
    }
  }
  if (isInjectEdge.value) {
    return {
      delete: t('selection.edgeDelete'),
      edit: t('selection.edgeEditSource'),
    }
  }
  if (isBranchEdge.value) {
    return {
      delete: t('selection.edgeDelete'),
      edit: t('selection.edgeEditSource'),
      pickPath: t('selection.edgeReselectBranch'),
    }
  }
  if (isJsSingleEdge.value) {
    return {
      delete: t('selection.edgeDelete'),
      edit: t('selection.edgeEditSource'),
      pickPath: t('selection.edgeToggleResult'),
    }
  }
  return {
    delete: t('selection.edgeDelete'),
    edit: t('selection.edgeEditSource'),
  }
})

function onEdit() {
  const edge = currentEdge()
  if (!edge || !props.lf) return

  if (!isHttpEdge.value) {
    emit('edit', { edgeId: edge.id, sourceNodeId: edge.sourceNodeId })
    props.lf.selectElementById?.(edge.sourceNodeId)
    return
  }

  // HTTP：弹出当前路径的调试值编辑
  const source = props.lf.getNodeModelById?.(edge.sourceNodeId)
  if (!source) return
  const routers = readRouters(source.properties?.configuration)
  let idx = Number(edge.properties?.routerIndex)
  if (!Number.isFinite(idx) || idx < 0) {
    const rel = String(edge.properties?.relation || '')
    idx = routers.findIndex((r) => routerRelation(r) === rel)
  }
  if (idx < 0 || idx >= routers.length) return

  const r = routers[idx]
  debugEdgeId.value = edge.id
  debugSourceId.value = edge.sourceNodeId
  debugRouterIndex.value = idx
  debugTitle.value = routerLabel(r)
  debugSeed.value = r.debugValue || '{}'
  debugOpen.value = true
}

function onDebugConfirm(jsonText: string) {
  if (!props.lf) return
  const sourceId = debugSourceId.value
  const idx = debugRouterIndex.value
  const source = props.lf.getNodeModelById?.(sourceId)
  if (!source || idx < 0) return

  const conf = {
    ...((source.properties?.configuration as Record<string, unknown>) || {}),
  }
  const routers = readRouters(conf).map((r, i) =>
    i === idx ? { ...r, debugValue: jsonText } : { ...r },
  )
  conf.routers = routers
  props.lf.setProperties?.(sourceId, {
    ...source.properties,
    configuration: conf,
  })
  emit('change')
}

function onDelete() {
  const edge = currentEdge()
  if (!edge) return
  emit('delete', edge.id)
  props.lf?.deleteEdge?.(edge.id)
}

function onRun() {
  const edge = currentEdge()
  if (!edge) return
  emit('run', edge.id)
}

async function onPickPath() {
  const edge = currentEdge()
  if (!edge || !props.lf) return
  if (isHttpEdge.value) {
    const ok = await rebindHttpEdgePath(props.lf, edge.id)
    if (ok) emit('change')
    return
  }
  if (isBranchEdge.value) {
    const ok = await rebindBranchEdgeRelation(props.lf, edge.id)
    if (ok) emit('change')
    return
  }
  if (isJsSingleEdge.value) {
    const ok = await rebindJsEdgeRelation(props.lf, edge.id)
    if (ok) emit('change')
  }
}
</script>

<template>
  <SelectionActionBar
    ref="barRef"
    :visible="visible"
    :x="pos.x"
    :y="pos.y"
    :flip-down="flipDown"
    :actions="actions"
    :aria-label="t('selection.edgeAria')"
    :tooltips="tooltips"
    @edit="onEdit"
    @delete="onDelete"
    @run="onRun"
    @pick-path="onPickPath"
    @bar-enter="onToolbarEnter"
    @bar-leave="onToolbarLeave"
  />
  <HttpRouterDebugDialog
    v-model="debugOpen"
    :title="debugTitle"
    :value="debugSeed"
    @confirm="onDebugConfirm"
  />
</template>
