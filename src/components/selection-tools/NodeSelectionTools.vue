<script setup lang="ts">
/**
 * 节点悬停浮动操作栏：鼠标移入节点即显示，移出延迟隐藏。
 * 与连线栏共用互斥状态，同一时刻只显示一个。
 * 按钮集合由后端 ComponentDef.actions 声明。
 */
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LfInstance } from '@/canvas/lf-types'
import { cachedNodeActions } from '@/canvas/componentCatalog'
import { useHoverTools } from '@/canvas/useHoverTools'
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
  test: [nodeId: string]
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
  setPlaceAt,
  setGetModel,
  watchLf,
  onToolbarEnter,
  onToolbarLeave,
} = useHoverTools({
  kind: 'node',
  existsInGraph: (lf, id) => !!lf?.graphModel?.getNodeModelById?.(id),
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
  return list.filter((a) => a === 'run' || a === 'runOnly' || a === 'test')
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
function onTest() {
  const id = requireId()
  if (!id) return
  emit('test', id)
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
    @test="onTest"
    @bar-enter="onToolbarEnter"
    @bar-leave="onToolbarLeave"
  />
</template>
