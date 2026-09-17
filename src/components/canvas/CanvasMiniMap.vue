<script setup lang="ts">
/**
 * 画布右下角小地图：展开时用 LogicFlow MiniMap；
 * 右键菜单：显示所有 / 导出图片 / 关闭；关闭后收起为浮动按钮。
 */
import { nextTick, onBeforeUnmount, reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { MapLocation } from '@element-plus/icons-vue'
import type { LfInstance } from '@/canvas/lf-types'
import {
  getMiniMap,
  hideMiniMap,
  showMiniMap,
  showMiniMapWhenReady,
} from '@/canvas/minimap'
import { exportCanvasAsJpeg } from '@/canvas/exportCanvasImage'

const props = defineProps<{
  lf: LfInstance | null
}>()

const { t } = useI18n()

/** true = 展开小地图；false = 仅浮动按钮 */
const expanded = ref(true)

const menuRef = useTemplateRef<HTMLElement>('menuRef')
const menu = reactive({
  open: false,
  x: 0,
  y: 0,
})

/** 菜单相对定位容器（画布 wrap），打开时记录便于边界钳制 */
let menuHost: HTMLElement | null = null

let boundLf: LfInstance | null = null
let unbindCtx: (() => void) | null = null

const MENU_PAD = 8

function closeMenu() {
  menu.open = false
}

/**
 * 按菜单实际宽高，将坐标钳制在宿主矩形内，避免溢出屏幕/画布。
 * 优先向左、向上翻折（右下角小地图场景）。
 */
function placeMenuInsideHost(clientX: number, clientY: number) {
  const host = menuHost
  if (!host) {
    menu.x = clientX
    menu.y = clientY
    return
  }
  const hr = host.getBoundingClientRect()
  const mr = menuRef.value?.getBoundingClientRect()
  const mw = mr?.width || 140
  const mh = mr?.height || 110

  let x = clientX - hr.left
  let y = clientY - hr.top

  // 右侧越界：翻到指针左侧
  if (x + mw + MENU_PAD > hr.width) {
    x = clientX - hr.left - mw
  }
  // 底部越界：翻到指针上方
  if (y + mh + MENU_PAD > hr.height) {
    y = clientY - hr.top - mh
  }

  menu.x = Math.max(MENU_PAD, Math.min(x, hr.width - mw - MENU_PAD))
  menu.y = Math.max(MENU_PAD, Math.min(y, hr.height - mh - MENU_PAD))
}

async function openMenuAt(e: MouseEvent, host: HTMLElement) {
  menuHost = host
  // 先落点打开，测完尺寸再钳制
  menu.x = e.clientX - host.getBoundingClientRect().left
  menu.y = e.clientY - host.getBoundingClientRect().top
  menu.open = true
  await nextTick()
  placeMenuInsideHost(e.clientX, e.clientY)
}

function onMiniMapClose() {
  expanded.value = false
  closeMenu()
}

function onDocPointerDown(e: Event) {
  if (!menu.open) return
  const t = e.target as Element | null
  if (t?.closest?.('.fg-minimap-menu')) return
  closeMenu()
}

function bindContextMenu(lf: LfInstance) {
  unbindCtx?.()
  unbindCtx = null
  const el = getMiniMap(lf)?.miniMapContainer
  if (!el) return
  const onCtx = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const wrap =
      (el.closest('.canvas-wrap') as HTMLElement | null) ||
      (el.offsetParent as HTMLElement | null) ||
      document.body
    void openMenuAt(e, wrap)
  }
  el.addEventListener('contextmenu', onCtx)
  unbindCtx = () => el.removeEventListener('contextmenu', onCtx)
}

/** 显示后绑定右键（DOM 可能新建） */
function showAndBind(lf: LfInstance) {
  showMiniMapWhenReady(lf)
  // 等 show 完成后再绑
  let n = 0
  const tryBind = () => {
    const mm = getMiniMap(lf)
    if (mm?.isShow && mm.miniMapContainer) {
      bindContextMenu(lf)
      return
    }
    if (n++ < 20) requestAnimationFrame(tryBind)
  }
  requestAnimationFrame(tryBind)
}

function bind(lf: LfInstance | null) {
  unbindCtx?.()
  unbindCtx = null
  if (boundLf) {
    boundLf.off?.('miniMap:close', onMiniMapClose)
    boundLf = null
  }
  closeMenu()
  if (!lf) return
  boundLf = lf
  lf.on?.('miniMap:close', onMiniMapClose)
  if (expanded.value) {
    showAndBind(lf)
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
  closeMenu()
  if (open) {
    showAndBind(lf)
  } else {
    unbindCtx?.()
    unbindCtx = null
    hideMiniMap(lf)
  }
})

/** DSL 整图渲染后刷新缩略（不拆 DOM） */
function refresh() {
  if (!expanded.value || !props.lf) return
  showMiniMap(props.lf)
  bindContextMenu(props.lf)
}

function expand() {
  expanded.value = true
}

function onFitAll() {
  closeMenu()
  props.lf?.fitView?.(40, 40)
}

function onCloseMap() {
  closeMenu()
  expanded.value = false
}

async function onExport() {
  closeMenu()
  const r = await exportCanvasAsJpeg(props.lf)
  if (r.ok) {
    ElMessage.success(
      r.selection
        ? t('canvas.minimap.exportSelectionOk')
        : t('canvas.minimap.exportOk'),
    )
    return
  }
  if (r.reason === 'empty') {
    ElMessage.warning(t('canvas.minimap.exportEmpty'))
  } else if (r.reason === 'no-snapshot') {
    ElMessage.error(t('canvas.minimap.exportNoPlugin'))
  } else {
    ElMessage.error(t('canvas.minimap.exportFailed'))
  }
}

watch(
  () => menu.open,
  (open) => {
    if (open) {
      window.addEventListener('pointerdown', onDocPointerDown, true)
      window.addEventListener('scroll', closeMenu, true)
    } else {
      window.removeEventListener('pointerdown', onDocPointerDown, true)
      window.removeEventListener('scroll', closeMenu, true)
    }
  },
)

onBeforeUnmount(() => {
  closeMenu()
  window.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('scroll', closeMenu, true)
  unbindCtx?.()
  unbindCtx = null
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

  <div
    v-if="menu.open"
    ref="menuRef"
    class="fg-minimap-menu"
    role="menu"
    :aria-label="t('canvas.minimap.menuAria')"
    :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
    @contextmenu.prevent
  >
    <button type="button" role="menuitem" class="fg-minimap-menu__item" @click="onFitAll">
      {{ t('canvas.minimap.fitAll') }}
    </button>
    <button type="button" role="menuitem" class="fg-minimap-menu__item" @click="onExport">
      {{ t('canvas.minimap.exportImage') }}
    </button>
    <button
      type="button"
      role="menuitem"
      class="fg-minimap-menu__item fg-minimap-menu__item--danger"
      @click="onCloseMap"
    >
      {{ t('canvas.minimap.close') }}
    </button>
  </div>
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
  opacity: 0.55;
  transition: opacity 0.15s ease;
}
.fg-minimap-fab:hover {
  opacity: 1;
  background: #f1f5f9;
  color: #2563eb;
}

.fg-minimap-menu {
  position: absolute;
  z-index: 30;
  min-width: 132px;
  padding: 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
.fg-minimap-menu__item {
  display: block;
  width: 100%;
  margin: 0;
  padding: 7px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #334155;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.fg-minimap-menu__item:hover {
  background: #f1f5f9;
  color: #2563eb;
}
.fg-minimap-menu__item--danger:hover {
  background: #fef2f2;
  color: #dc2626;
}
</style>
