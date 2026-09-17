/**
 * 全局变量列表编辑：每行一项；JSON 在弹窗中用代码编辑器修改。
 * 删除前提供复制按钮，写入剪贴板 global.变量名。
 */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus, Delete, CopyDocument, Edit } from '@element-plus/icons-vue'
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

/** JSON 弹窗状态 */
const jsonDialogVisible = ref(false)
const jsonEditIdx = ref(-1)
const jsonEditText = ref('{}')
const jsonEditTitle = ref('')

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

/** JSON 摘要（单行展示） */
function jsonSummary(row: GlobalVarItem) {
  try {
    const s =
      typeof row.value === 'string'
        ? row.value
        : JSON.stringify(row.value ?? {})
    const one = s.replace(/\s+/g, ' ').trim()
    if (!one) return '{}'
    return one.length > 40 ? `${one.slice(0, 40)}…` : one
  } catch {
    return '{…}'
  }
}

function jsonText(row: GlobalVarItem) {
  if (typeof row.value === 'string') return row.value
  try {
    return JSON.stringify(row.value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function openJsonEditor(idx: number) {
  const row = (props.modelValue || [])[idx]
  if (!row) return
  jsonEditIdx.value = idx
  jsonEditText.value = jsonText(row)
  const name = String(row.name || '').trim()
  jsonEditTitle.value = name
    ? t('forms.globalVars.jsonEditTitleNamed', { name })
    : t('forms.globalVars.jsonEditTitle')
  jsonDialogVisible.value = true
}

function applyJsonEditor() {
  const idx = jsonEditIdx.value
  if (idx < 0) {
    jsonDialogVisible.value = false
    return
  }
  const s = String(jsonEditText.value ?? '')
  const trimmed = s.trim()
  if (!trimmed) {
    patch(idx, { value: null })
    jsonDialogVisible.value = false
    return
  }
  try {
    patch(idx, { value: JSON.parse(trimmed) })
    jsonDialogVisible.value = false
  } catch {
    ElMessage.error(t('forms.globalVars.jsonInvalid'))
  }
}

/** 复制 global.变量名 到剪贴板 */
async function copyRef(row: GlobalVarItem) {
  const name = String(row.name || '').trim()
  if (!name) {
    ElMessage.warning(t('forms.globalVars.copyNeedName'))
    return
  }
  const text = `global.${name}`
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('forms.globalVars.copySuccess', { text }))
  } catch {
    ElMessage.error(t('forms.globalVars.copyFailed'))
  }
}
</script>

<template>
  <div class="gvars">
    <div v-for="(row, idx) in modelValue || []" :key="idx" class="gvars__row">
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
        class="gvars__val"
        @update:model-value="(v: boolean) => patch(idx, { value: v })"
      />
      <el-input-number
        v-else-if="row.type === 'number'"
        :model-value="numberValue(row)"
        class="gvars__val gvars__num"
        controls-position="right"
        @update:model-value="(v: number | undefined) => patch(idx, { value: v ?? 0 })"
      />
      <div v-else-if="row.type === 'json'" class="gvars__val gvars__json-cell">
        <span class="gvars__json-summary" :title="jsonSummary(row)">{{
          jsonSummary(row)
        }}</span>
        <el-button
          type="primary"
          link
          :icon="Edit"
          :title="t('forms.globalVars.editJson')"
          @click="openJsonEditor(idx)"
        >
          {{ t('forms.globalVars.editJson') }}
        </el-button>
      </div>
      <el-input
        v-else
        :model-value="String(row.value ?? '')"
        :placeholder="t('forms.globalVars.valuePlaceholder')"
        class="gvars__val"
        @update:model-value="(v: string) => patch(idx, { value: v })"
      />
      <el-button
        type="primary"
        link
        :icon="CopyDocument"
        :title="t('forms.globalVars.copy')"
        @click="copyRef(row)"
      />
      <el-button
        type="danger"
        link
        :icon="Delete"
        :title="t('forms.globalVars.remove')"
        @click="removeRow(idx)"
      />
    </div>
    <el-button type="primary" link :icon="Plus" @click="addRow">
      {{ t('forms.globalVars.add') }}
    </el-button>

    <el-dialog
      v-model="jsonDialogVisible"
      :title="jsonEditTitle"
      width="640px"
      append-to-body
      destroy-on-close
      align-center
    >
      <CodeBlockField
        v-model="jsonEditText"
        language="json"
        height="320px"
      />
      <template #footer>
        <el-button @click="jsonDialogVisible = false">{{
          t('common.cancel')
        }}</el-button>
        <el-button type="primary" @click="applyJsonEditor">{{
          t('common.ok')
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.gvars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.gvars__row {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
  width: 100%;
  min-width: 0;
}
.gvars__name {
  width: 100px;
  flex: 0 0 auto;
}
.gvars__type {
  width: 100px;
  flex: 0 0 auto;
}
.gvars__val {
  flex: 1 1 auto;
  min-width: 0;
}
.gvars__num {
  width: 100%;
}
.gvars__json-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.gvars__json-summary {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #6b7280;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
