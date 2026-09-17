<script setup lang="ts">
/**
 * 节点组件库：分组与条目来自后端 GET /api/components。
 * 拖入画布时标记 palette DnD，避免伪空白点击抑制吞掉 pointerup。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Expand, Fold, Search } from '@element-plus/icons-vue'
import type { LfInstance } from '@/canvas/lf-types'
import {
  invalidateComponentCatalog,
  loadComponentGroups,
} from '@/canvas/componentCatalog'
import { currentLocale } from '@/i18n'
import {
  clearPaletteDndActive,
  markPaletteDndActive,
} from '@/canvas/suppressSpuriousBlankClick'
import { buildDefaultsFromFields } from '@/components/editor/dynamic/configDefaults'
import type { PaletteGroup, PaletteItem } from '@/types/flow'

const props = defineProps<{
  lf: LfInstance | null
  /** 流程锁定时禁止拖入节点 */
  disabled?: boolean
}>()

const { t } = useI18n()

const groups = ref<PaletteGroup[]>([])
const activeNames = ref<string[]>([])
const keyword = ref('')
const loading = ref(false)
const error = ref('')

async function reload() {
  loading.value = true
  error.value = ''
  try {
    const list = await loadComponentGroups(true)
    groups.value = list
    activeNames.value = list.filter((g) => g.items.length > 0).map((g) => g.id)
  } catch {
    error.value = t('nodePalette.loadFailed')
    groups.value = []
  } finally {
    loading.value = false
  }
}

/** 界面语言变更后重新拉取本地化后的组件名 */
watch(currentLocale, () => {
  invalidateComponentCatalog()
  void reload()
})

onMounted(() => {
  void reload()
})

/** 按关键词过滤后的分组（匹配 type / label / description） */
const filteredGroups = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return groups.value
  const out: PaletteGroup[] = []
  for (const g of groups.value) {
    const items = (g.items || []).filter((it) => {
      const type = (it.type || '').toLowerCase()
      const label = (it.label || '').toLowerCase()
      const desc = (it.description || '').toLowerCase()
      return type.includes(q) || label.includes(q) || desc.includes(q)
    })
    if (items.length) {
      out.push({ ...g, items })
    }
  }
  return out
})

/** 搜索时自动展开有结果的分组 */
watch(filteredGroups, (list) => {
  if (!keyword.value.trim()) return
  activeNames.value = list.map((g) => g.id)
})

/** 展开全部节点分组（以当前过滤结果为准） */
function expandAll() {
  activeNames.value = filteredGroups.value.map((g) => g.id)
}

/** 收起全部节点分组 */
function collapseAll() {
  activeNames.value = []
}

function defaultConfiguration(item: PaletteItem): Record<string, unknown> {
  return buildDefaultsFromFields(item.configFields, item.defaultScript)
}

/** 入端口数：缺省 1；入口类无入 */
function inPortCount(item: PaletteItem): number {
  if (typeof item.inPorts === 'number') return Math.max(0, item.inPorts)
  if (item.type === 'inject' || item.type === 'httpEndpoint') return 0
  return 1
}

/** 出端口数：缺省 1；出口类无出 */
function outPortCount(item: PaletteItem): number {
  if (typeof item.outPorts === 'number') return Math.max(0, item.outPorts)
  if (item.type === 'httpResponse') return 0
  return 1
}

function onMouseDown(item: PaletteItem, lf: LfInstance | null) {
  if (!lf || props.disabled) return
  markPaletteDndActive()
  const clear = () => {
    clearPaletteDndActive()
    window.removeEventListener('pointerup', clear, true)
    window.removeEventListener('pointercancel', clear, true)
  }
  window.addEventListener('pointerup', clear, true)
  window.addEventListener('pointercancel', clear, true)

  lf.dnd.startDrag({
    type: item.type,
    text: item.label,
    properties: {
      name: item.label,
      configuration: defaultConfiguration(item),
      isEntry: false,
      color: item.color || '#fdd0a2',
      iconText: item.iconText || 'ƒ',
    },
  })
}

defineExpose({ reload })
</script>

<template>
  <div class="palette" :class="{ 'is-disabled': disabled }">
    <div v-if="disabled" class="palette__lock-hint">{{ t('nodePalette.lockHint') }}</div>
    <div class="palette__head">
      <el-input
        v-model="keyword"
        size="small"
        :placeholder="t('nodePalette.searchPlaceholder')"
        clearable
        :prefix-icon="Search"
      />
      <button
        class="palette__btn"
        type="button"
        :title="t('nodePalette.expandAll')"
        @click="expandAll"
      >
        <el-icon><Expand /></el-icon>
      </button>
      <button
        class="palette__btn"
        type="button"
        :title="t('nodePalette.collapseAll')"
        @click="collapseAll"
      >
        <el-icon><Fold /></el-icon>
      </button>
    </div>
    <div v-if="loading" class="palette__hint">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="palette__hint is-error">
      {{ error }}
      <button class="palette__retry" type="button" @click="reload">{{ t('common.retry') }}</button>
    </div>
    <div
      v-else-if="!filteredGroups.some((g) => g.items.length)"
      class="palette__hint"
    >
      {{ keyword.trim() ? t('nodePalette.emptyMatch') : t('nodePalette.empty') }}
    </div>
    <template v-else>
      <el-collapse v-model="activeNames" class="palette__collapse">
        <el-collapse-item
          v-for="group in filteredGroups"
          :key="group.id"
          :name="group.id"
        >
          <template #title>
            <span class="palette__gtitle">
              {{ group.label }}
              <span class="palette__count">{{ group.items.length }}</span>
            </span>
          </template>
          <div v-if="!group.items.length" class="palette__empty">{{ t('nodePalette.empty') }}</div>
          <div v-else class="palette__body">
            <div
              v-for="item in group.items"
              :key="item.type"
              class="nr-item"
              :style="{ background: item.color || '#fdd0a2' }"
              @mousedown="onMouseDown(item, lf)"
            >
              <!-- 左侧入端口（与画布锚点同形，常显） -->
              <span
                v-if="inPortCount(item) > 0"
                class="nr-ports nr-ports--in"
                aria-hidden="true"
              >
                <i
                  v-for="n in inPortCount(item)"
                  :key="`in-${n}`"
                  class="nr-port"
                />
              </span>
              <span class="nr-icon" aria-hidden="true">{{
                item.iconText || 'ƒ'
              }}</span>
              <span class="nr-label">{{ item.label }}</span>
              <!-- 右侧出端口 -->
              <span
                v-if="outPortCount(item) > 0"
                class="nr-ports nr-ports--out"
                aria-hidden="true"
              >
                <i
                  v-for="n in outPortCount(item)"
                  :key="`out-${n}`"
                  class="nr-port"
                />
              </span>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
      <p class="tip">{{ t('nodePalette.tip') }}</p>
    </template>
  </div>
</template>

<style scoped>
.palette {
  padding: 4px 6px 8px;
}
.palette.is-disabled {
  opacity: 0.72;
  pointer-events: none;
}
.palette__lock-hint {
  margin: 0 2px 6px;
  padding: 4px 6px;
  font-size: 11px;
  color: #b45309;
  background: #fff7ed;
  border-radius: 4px;
}
.palette__head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 2px 6px;
  position: sticky;
  top: 0;
  background: #f3f3f3;
  z-index: 1;
}
.palette__btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  color: #555;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.palette__btn:hover {
  background: #eee;
  color: #222;
}
.palette__hint {
  padding: 8px 6px;
  font-size: 12px;
  color: #888;
}
.palette__hint.is-error {
  color: #c45656;
}
.palette__retry {
  margin-left: 6px;
  border: none;
  background: transparent;
  color: #409eff;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.palette__collapse {
  border: none;
  --el-collapse-header-height: 30px;
  --el-collapse-header-bg-color: transparent;
  --el-collapse-content-bg-color: transparent;
}
.palette__collapse :deep(.el-collapse-item__header) {
  font-size: 12px;
  color: #555;
  padding: 0 4px;
  border-bottom: 1px solid #e0e0e0;
  background: transparent;
}
.palette__collapse :deep(.el-collapse-item__wrap) {
  border-bottom: none;
  background: transparent;
}
.palette__collapse :deep(.el-collapse-item__content) {
  padding: 0;
}
.palette__gtitle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.palette__count {
  font-size: 11px;
  color: #999;
}
.palette__empty {
  font-size: 11px;
  color: #aaa;
  padding: 6px 8px;
}
.palette__body {
  padding: 6px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.nr-item {
  position: relative;
  display: flex;
  align-items: stretch;
  height: 30px;
  border: 1px solid #999;
  border-radius: 5px;
  cursor: grab;
  user-select: none;
  overflow: visible;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.06);
}
.nr-item:active {
  cursor: grabbing;
}
.nr-item:hover {
  border-color: #666;
}
.nr-icon {
  width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.06);
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-size: 14px;
  color: #666;
  flex-shrink: 0;
  border-radius: 4px 0 0 4px;
}
.nr-label {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 12px;
  color: #333;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 与画布 .fg-nr-anchor 同形的常显端口块 */
.nr-ports {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  pointer-events: none;
  z-index: 1;
}
.nr-ports--in {
  left: -4px;
}
.nr-ports--out {
  right: -4px;
}
.nr-port {
  display: block;
  width: 8px;
  height: 8px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #999;
  border-radius: 1px;
}
.tip {
  margin: 8px 2px 0;
  font-size: 11px;
  color: #888;
  line-height: 1.4;
}
</style>
