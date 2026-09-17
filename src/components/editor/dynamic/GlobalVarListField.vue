/**
 * 全局变量列表编辑：动态添加 name / type / value。
 * JSON 类型使用 CodeMirror 代码编辑器。
 */
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Delete } from '@element-plus/icons-vue'
import CodeBlockField from '@/components/common/CodeBlockField.vue'
import type { GlobalVarItem, GlobalVarType } from './globalVarList'

const props = defineProps<{
  modelValue: GlobalVarItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [v: GlobalVarItem[]]
  change: []
}>()

const { t } = useI18n()

const typeOptions = computed(() => [
  { value: 'string', label: t('forms.globalVars.typeString') },
  { value: 'number', label: t('forms.globalVars.typeNumber') },
  { value: 'boolean', label: t('forms.globalVars.typeBoolean') },
  { value: 'json', label: t('forms.globalVars.typeJson') },
])

function emitList(list: GlobalVarItem[]) {
  emit('update:modelValue', list)
  emit('change')
}

function addRow() {
  emitList([
    ...(props.modelValue || []),
    { name: '', type: 'string', value: '' },
  ])
}

function removeRow(idx: number) {
  const next = [...(props.modelValue || [])]
  next.splice(idx, 1)
  emitList(next)
}

function patch(idx: number, part: Partial<GlobalVarItem>) {
  const next = (props.modelValue || []).map((row, i) =>
    i === idx ? { ...row, ...part } : row,
  )
  emitList(next)
}

function onTypeChange(idx: number, typ: GlobalVarType) {
  let value: unknown = ''
  if (typ === 'number') value = 0
  else if (typ === 'boolean') value = false
  else if (typ === 'json') value = {}
  else value = ''
  patch(idx, { type: typ, value })
}

function boolValue(row: GlobalVarItem) {
  return row.value === true || row.value === 'true' || row.value === 1
}

function numberValue(row: GlobalVarItem) {
  const n = Number(row.value)
  return Number.isFinite(n) ? n : 0
}

/** JSON 编辑器展示文本 */
function jsonText(row: GlobalVarItem) {
  if (typeof row.value === 'string') return row.value
  try {
    return JSON.stringify(row.value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

/**
 * 代码编辑器内容变更：能 parse 则存对象，否则暂存原文以便继续编辑。
 */
function onJsonUpdate(idx: number, text: string) {
  const s = String(text ?? '')
  const trimmed = s.trim()
  if (!trimmed) {
    patch(idx, { value: null })
    return
  }
  try {
    patch(idx, { value: JSON.parse(trimmed) })
  } catch {
    patch(idx, { value: s })
  }
}
</script>

<template>
  <div class="gvars">
    <div v-for="(row, idx) in modelValue || []" :key="idx" class="gvars__row">
      <div class="gvars__top">
        <el-input
          :model-value="row.name"
          :placeholder="t('forms.globalVars.namePlaceholder')"
          class="gvars__name"
          @update:model-value="(v: string) => patch(idx, { name: v })"
        />
        <el-select
          :model-value="row.type"
          class="gvars__type"
          @update:model-value="(v: GlobalVarType) => onTypeChange(idx, v)"
        >
          <el-option
            v-for="opt in typeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-switch
          v-if="row.type === 'boolean'"
          :model-value="boolValue(row)"
          @update:model-value="(v: boolean) => patch(idx, { value: v })"
        />
        <el-input-number
          v-else-if="row.type === 'number'"
          :model-value="numberValue(row)"
          class="gvars__num"
          controls-position="right"
          @update:model-value="(v: number | undefined) => patch(idx, { value: v ?? 0 })"
        />
        <el-input
          v-else-if="row.type !== 'json'"
          :model-value="String(row.value ?? '')"
          :placeholder="t('forms.globalVars.valuePlaceholder')"
          class="gvars__val"
          @update:model-value="(v: string) => patch(idx, { value: v })"
        />
        <el-button
          type="danger"
          link
          :icon="Delete"
          :title="t('forms.globalVars.remove')"
          @click="removeRow(idx)"
        />
      </div>
      <div v-if="row.type === 'json'" class="gvars__json">
        <CodeBlockField
          language="json"
          height="140px"
          :model-value="jsonText(row)"
          @update:model-value="(v) => onJsonUpdate(idx, v)"
        />
      </div>
    </div>
    <el-button type="primary" link :icon="Plus" @click="addRow">
      {{ t('forms.globalVars.add') }}
    </el-button>
  </div>
</template>

<style scoped>
.gvars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.gvars__row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}
.gvars__row:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}
.gvars__top {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.gvars__name {
  width: 110px;
  flex: 0 0 auto;
}
.gvars__type {
  width: 110px;
  flex: 0 0 auto;
}
.gvars__val,
.gvars__num {
  flex: 1 1 120px;
  min-width: 100px;
}
.gvars__json {
  width: 100%;
  min-width: 0;
}
</style>
