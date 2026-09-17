<script setup lang="ts">
/**
 * 画布右下角小地图：展开时用 LogicFlow MiniMap（可拖预览框导航）；
 * 点关闭后收起为浮动按钮，再点展开。
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MapLocation } from '@element-plus/icons-vue'
import type { LfInstance } from '@/canvas/lf-types'
import {
  getMiniMap,
  hideMiniMap,
  showMiniMap,
  showMiniMapWhenReady,
} from '@/canvas/minimap'

const props = defineProps<{
  lf: LfInstance | null
}>()

const { t } = useI18n()

/** true = 展开小地图；false = 仅浮动按钮 */
const expanded = ref(true)

let boundLf: LfInstance | null = null

function onMiniMapClose() {
  expanded.value = false
}

function bind(lf: LfInstance | null) {
  if (boundLf) {
    boundLf.off?.('miniMap:close', onMiniMapClose)
    boundLf = null
  }
  if (!lf) return
  boundLf = lf
  lf.on?.('miniMap:close', onMiniMapClose)
  if (expanded.value) {
    showMiniMapWhenReady(lf, t('canvas.minimap.title'))
  } else {
    hideMiniMap(lf)
  }
}

watch(
  () => props.lf,
  (nv) => bind(nv),
  { immediate: true },
)

watch(expanded, (open) => {
  const lf = props.lf
  if (!lf) return
  if (open) {
    showMiniMapWhenReady(lf, t('canvas.minimap.title'))
  } else {
    hideMiniMap(lf)
  }
})

/** DSL 整图渲染后刷新缩略（不拆 DOM） */
function refresh() {
  if (!expanded.value || !props.lf) return
  showMiniMap(props.lf, t('canvas.minimap.title'))
}

function expand() {
  expanded.value = true
}

onBeforeUnmount(() => {
  if (boundLf) {
    boundLf.off?.('miniMap:close', onMiniMapClose)
    hideMiniMap(boundLf)
    boundLf = null
  }
})

defineExpose({ refresh, expand })
</script>

<template>
  <el-tooltip
    v-if="lf && !expanded"
    :content="t('canvas.minimap.open')"
    placement="left"
    :show-after="300"
  >
    <el-button
      class="fg-minimap-fab"
      :icon="MapLocation"
      circle
      :aria-label="t('canvas.minimap.open')"
      @click="expand"
    />
  </el-tooltip>
</template>

<style scoped>
.fg-minimap-fab {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 12;
  width: 36px;
  height: 36px;
  padding: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #64748b;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}
.fg-minimap-fab:hover {
  background: #f1f5f9;
  color: #2563eb;
}
</style>
