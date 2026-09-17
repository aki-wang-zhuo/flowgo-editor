<script setup lang="ts">
/**
 * 节点选中浮动操作栏：按钮集合由后端 ComponentDef.actions 声明。
 */
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LfInstance } from '@/canvas/lf-types'
import { cachedNodeActions } from '@/canvas/componentCatalog'
import { useSelectionTools } from '@/canvas/useSelectionTools'
import SelectionActionBar from './SelectionActionBar.vue'
import {
  NODE_DEFAULT_ACTIONS,
  resolveNodeActions,
  type SelectionActionKey,
} from './actionKeys'

const props = withDefaults(
  defineProps<{
    lf: LfInstance | null
    /** 覆盖默认按钮顺序（仍会再按后端 actions 过滤） */
    actions?: SelectionActionKey[]
    /** 流程锁定时隐藏修改/删除，仅保留运行类 */
    locked?: boolean
  }>(),
  {
    actions: () => [...NODE_DEFAULT_ACTIONS],
    locked: false,
  },
)

const emit = defineEmits<{
  edit: [nodeId: string]
  delete: [nodeId: string]
  run: [nodeId: string]
  runOnly: [nodeId: string]
}>()

const { t } = useI18n()

const GAP = 6
const EDGE_PADDING = 4

const barRef = useTemplateRef<InstanceType<typeof SelectionActionBar>>('barRef')

const {
  visible,
  pos,
  targetId,
  flipDown,
  setDecide,
  setPlaceAt,
  setGetModel,
  watchLf,
} = useSelectionTools({
  existsInGraph: (lf, id) => !!lf?.graphModel?.getNodeModelById?.(id),
})

setDecide(({ nodes, edges }) => {
  if (edges.length > 0) return null
  if (nodes.length !== 1) return null
  return { targetId: nodes[0].id }
})

setGetModel((lf, id) => lf?.graphModel?.getNodeModelById?.(id))

setPlaceAt((nodeModel, graphModel, lf) => {
  const model = nodeModel as { x: number; y: number; height?: number }
  const gm = graphModel as {
    transformModel?: {
      CanvasPointToHtmlPoint: (p: number[]) => number[]
    }
  }
  const tm = gm?.transformModel
  if (!tm?.CanvasPointToHtmlPoint) return null

  const topX = model.x
  const topY = model.y - (model.height || 30) / 2
  const [hx, hy] = tm.CanvasPointToHtmlPoint([topX, topY])

  const size = barRef.value?.getSize?.() || { width: 0, height: 0 }
  const tw = size.width || 120
  const th = size.height || 32
  const canvasW = lf.container?.clientWidth || 0

  let x = hx - tw / 2
  let y = hy - GAP - th
  let flip = false
  if (y < EDGE_PADDING && th > 0) {
    const bottomY = model.y + (model.height || 30) / 2
    const [, bhy] = tm.CanvasPointToHtmlPoint([topX, bottomY])
    y = bhy + GAP
    flip = true
  }
  if (canvasW > 0) {
    x = Math.max(EDGE_PADDING, Math.min(x, canvasW - tw - EDGE_PADDING))
  }
  return { x, y, flipDown: flip }
})

watchLf(() => props.lf)

/** 按后端声明的 actions 过滤快捷按钮；锁定时去掉编辑类 */
const actions = computed(() => {
  const id = targetId.value
  let list = props.actions
  if (id && props.lf) {
    const model = props.lf.getNodeModelById?.(id) as { type?: string } | undefined
    const type = model?.type || ''
    list = resolveNodeActions(cachedNodeActions(type), props.actions)
  }
  if (!props.locked) return list
  return list.filter((a) => a === 'run' || a === 'runOnly')
})

function requireId(): string | null {
  return targetId.value
}

function onEdit() {
  const id = requireId()
  if (id) emit('edit', id)
}
function onDelete() {
  const id = requireId()
  if (!id) return
  emit('delete', id)
  props.lf?.deleteNode?.(id)
}
function onRun() {
  const id = requireId()
  if (!id) return
  emit('run', id)
}
function onRunOnly() {
  const id = requireId()
  if (!id) return
  emit('runOnly', id)
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
    :aria-label="t('selection.nodeAria')"
    @edit="onEdit"
    @delete="onDelete"
    @run="onRun"
    @runOnly="onRunOnly"
  />
</template>
