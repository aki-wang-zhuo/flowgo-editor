<script setup lang="ts">
/**
 * 编辑器底部调试控制台：可拖拽调高、日志本地缓存、清空同步清本地。
 */
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Delete, Close } from '@element-plus/icons-vue'
import {
  clearConsole,
  closeConsole,
  consoleAutoClear,
  consoleHeight,
  consoleLogs,
  consoleVisible,
  setConsoleAutoClear,
  startConsoleHeightResize,
} from '@/console/useEditorConsole'

const { t } = useI18n()

const terminalRef = ref<HTMLElement | null>(null)
const stickyBottom = ref(true)

watch(
  () => consoleLogs.value.length,
  async () => {
    if (!stickyBottom.value) return
    await nextTick()
    const el = terminalRef.value
    if (el) el.scrollTop = el.scrollHeight
  },
)

function onScroll() {
  const el = terminalRef.value
  if (!el) return
  stickyBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function onClear() {
  clearConsole()
}

function onAutoClearChange(v: string | number | boolean) {
  setConsoleAutoClear(!!v)
}

function onClose() {
  closeConsole()
}

function onResizeStart(e: MouseEvent) {
  startConsoleHeightResize(e)
}
</script>

<template>
  <div
    v-if="consoleVisible"
    class="fg-console"
    :style="{ height: `${consoleHeight}px` }"
  >
    <div
      class="fg-console__resizer"
      :title="t('console.resize')"
      @mousedown="onResizeStart"
    />
    <div class="fg-console__header">
      <span class="fg-console__title">{{ t('console.title') }}</span>
      <span class="fg-console__count" v-if="consoleLogs.length">{{ consoleLogs.length }}</span>
      <div class="fg-console__actions">
        <el-tooltip
          :content="t('console.autoClearTooltip')"
          placement="top"
          :show-after="300"
        >
          <label class="fg-console__auto">
            <span>{{ t('console.autoClear') }}</span>
            <el-switch
              :model-value="consoleAutoClear"
              size="small"
              @change="onAutoClearChange"
            />
          </label>
        </el-tooltip>
        <el-tooltip :content="t('console.clear')" placement="top" :show-after="300">
          <button type="button" class="fg-console__icon-btn" :aria-label="t('console.clear')" @click="onClear">
            <el-icon :size="14"><Delete /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip :content="t('console.close')" placement="top" :show-after="300">
          <button type="button" class="fg-console__icon-btn" :aria-label="t('console.close')" @click="onClose">
            <el-icon :size="14"><Close /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>
    <div ref="terminalRef" class="fg-console__terminal" @scroll="onScroll">
      <div
        v-for="item in consoleLogs"
        :key="item.id"
        class="fg-console__line"
      >
        <span class="ts">[{{ formatTs(item.ts) }}]</span>
        <span class="type" :class="item.flowType">{{ item.flowType }}</span>
        <span v-if="item.nodeName || item.nodeId" class="node">
          {{ item.nodeName || item.nodeId }}
          <span v-if="item.nodeName && item.nodeId" class="node-id">({{ item.nodeId }})</span>
        </span>
        <span v-if="item.durationMs != null" class="duration">{{ item.durationMs }}ms</span>
        <span v-if="item.relationType" class="relation">{{ item.relationType }}</span>
        <span class="content">{{ item.data }}</span>
        <span v-if="item.err" class="error">ERROR: {{ item.err }}</span>
      </div>
      <div v-if="!consoleLogs.length" class="fg-console__empty">{{ t('console.empty') }}</div>
    </div>
  </div>
</template>

<style scoped>
.fg-console {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  border-top: 1px solid #e5e7eb;
  background: #1e1e1e;
  color: #d4d4d4;
  z-index: 20;
}
.fg-console__resizer {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
  cursor: row-resize;
  z-index: 2;
}
.fg-console__resizer:hover,
.fg-console__resizer:active {
  background: rgba(64, 158, 255, 0.45);
}
.fg-console__header {
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  background: #252526;
  border-bottom: 1px solid #333;
}
.fg-console__title {
  font-size: 12px;
  font-weight: 600;
  color: #ccc;
}
.fg-console__count {
  font-size: 11px;
  color: #888;
}
.fg-console__actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
}
.fg-console__auto {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #bbb;
  cursor: pointer;
  user-select: none;
}
.fg-console__auto :deep(.el-switch) {
  --el-switch-on-color: #409eff;
}
.fg-console__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  opacity: 0.75;
}
.fg-console__icon-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}
.fg-console__terminal {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
}
.fg-console__line {
  padding-bottom: 4px;
  margin-bottom: 4px;
  border-bottom: 1px solid #2a2a2a;
  word-break: break-all;
}
.fg-console__line:last-child {
  border-bottom: none;
}
.ts {
  color: #6a9955;
  margin-right: 6px;
}
.type {
  font-weight: 700;
  margin-right: 6px;
  min-width: 36px;
  display: inline-block;
}
.type.IN {
  color: #4fc1ff;
}
.type.OUT {
  color: #ce9178;
}
.type.INFO {
  color: #dcdcaa;
}
.type.ERROR {
  color: #f14c4c;
}
.node {
  color: #9cdcfe;
  margin-right: 6px;
}
.node-id {
  color: #808080;
  font-size: 0.9em;
}
.duration {
  color: #b5cea8;
  margin-right: 6px;
  font-size: 0.9em;
}
.relation {
  color: #c586c0;
  margin-right: 6px;
}
.content {
  color: #ce9178;
}
.error {
  color: #f14c4c;
  margin-left: 6px;
}
.fg-console__empty {
  color: #666;
  padding: 12px 0;
  text-align: center;
}
</style>
