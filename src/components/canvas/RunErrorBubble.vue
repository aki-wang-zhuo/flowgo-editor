<script setup lang="ts">
/**
 * 运行失败时挂在出错节点上方的错误原因气泡。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Close, WarningFilled } from '@element-plus/icons-vue'
import type { LfInstance } from '@/canvas/lf-types'
import {
  subscribeRunError,
  clearRunErrors,
  type RunNodeError,
} from '@/run/runErrorHighlight'

const { t } = useI18n()

const TRANSFORM_EVENT = 'graph:transform'

const props = defineProps<{
  lf: LfInstance | null
}>()

const error = ref<RunNodeError | null>(null)
const pos = ref({ x: 0, y: 0 })
const visible = computed(() => !!error.value && !!props.lf)

let unsub: (() => void) | undefined
let boundLf: LfInstance | null = null
let raf = 0

function placeBubble() {
  const lf = props.lf
  const err = error.value
  if (!lf || !err) return
  const model = lf.getNodeModelById?.(err.nodeId) as
    | { x: number; y: number; width?: number; height?: number }
    | undefined
  if (!model) {
    pos.value = { x: 12, y: 12 }
    return
  }
  const gm = lf.graphModel as {
    transformModel?: {
      CanvasPointToHtmlPoint: (p: number[]) => number[]
    }
  }
  const tm = gm?.transformModel
  if (!tm?.CanvasPointToHtmlPoint) return
  const topX = model.x
  const topY = model.y - (model.height || 30) / 2
  const [hx, hy] = tm.CanvasPointToHtmlPoint([topX, topY])
  pos.value = { x: hx, y: Math.max(8, hy - 10) }
}

function schedulePlace() {
  if (raf) cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    raf = 0
    placeBubble()
  })
}

function onTransform() {
  if (error.value) schedulePlace()
}

function detachLf() {
  if (boundLf) {
    boundLf.off?.(TRANSFORM_EVENT, onTransform)
    boundLf = null
  }
  unsub?.()
  unsub = undefined
}

function attachLf(lf: LfInstance | null) {
  detachLf()
  error.value = null
  if (!lf) return
  boundLf = lf
  unsub = subscribeRunError((src, err) => {
    if (src !== lf) return
    error.value = err
    if (err) schedulePlace()
  })
  lf.on?.(TRANSFORM_EVENT, onTransform)
}

function dismiss() {
  if (props.lf) clearRunErrors(props.lf)
  else error.value = null
}

watch(
  () => props.lf,
  (lf) => {
    attachLf(lf)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  detachLf()
})
</script>

<template>
  <div
    v-if="visible && error"
    class="run-err-bubble"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    role="alert"
  >
    <el-icon class="run-err-bubble__icon" :size="14"><WarningFilled /></el-icon>
    <div class="run-err-bubble__body">
      <div class="run-err-bubble__title">{{ t('runError.title') }}</div>
      <div class="run-err-bubble__msg">{{ error.message }}</div>
    </div>
    <button
      type="button"
      class="run-err-bubble__close"
      :title="t('runError.close')"
      @click.stop="dismiss"
    >
      <el-icon :size="12"><Close /></el-icon>
    </button>
  </div>
</template>

<style scoped>
.run-err-bubble {
  position: absolute;
  z-index: 30;
  transform: translate(-50%, -100%);
  display: flex;
  align-items: flex-start;
  gap: 6px;
  max-width: min(320px, 70vw);
  padding: 8px 10px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  box-shadow: 0 6px 18px rgba(185, 28, 28, 0.18);
  pointer-events: auto;
  animation: run-err-pop 0.18s ease-out;
}
.run-err-bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6px;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #fef2f2;
  filter: drop-shadow(0 1px 0 #fecaca);
}
.run-err-bubble__icon {
  color: #dc2626;
  flex-shrink: 0;
  margin-top: 1px;
}
.run-err-bubble__body {
  min-width: 0;
  flex: 1;
}
.run-err-bubble__title {
  font-size: 12px;
  font-weight: 600;
  color: #b91c1c;
  line-height: 1.3;
}
.run-err-bubble__msg {
  margin-top: 2px;
  font-size: 12px;
  color: #7f1d1d;
  line-height: 1.4;
  word-break: break-word;
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
}
.run-err-bubble__close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #b91c1c;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.run-err-bubble__close:hover {
  background: rgba(185, 28, 28, 0.1);
}
@keyframes run-err-pop {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-100% + 6px));
  }
  to {
    opacity: 1;
    transform: translate(-50%, -100%);
  }
}
</style>
