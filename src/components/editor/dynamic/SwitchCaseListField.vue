/**
 * SWITCH 分支动态列表：每行「匹配值 | 数据类型 | 分支名称 | 删除」。
 */
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import {
  createDefaultSwitchCase,
  switchCaseKey,
  type SwitchCaseRow,
  type SwitchCaseValueType,
} from './switchCaseList'

const props = defineProps<{
  modelValue: SwitchCaseRow[]
}>()

const emit = defineEmits<{
  'update:modelValue': [v: SwitchCaseRow[]]
  change: []
}>()

const { t } = useI18n()

const typeOptions = computed(() => [
  { value: 'string', label: t('forms.switch.typeString') },
  { value: 'number', label: t('forms.switch.typeNumber') },
  { value: 'boolean', label: t('forms.switch.typeBoolean') },
])

function emitList(list: SwitchCaseRow[]) {
  emit('update:modelValue', list)
  emit('change')
}

function addRow() {
  emitList([...(props.modelValue || []), createDefaultSwitchCase()])
}

function removeRow(idx: number) {
  const next = [...(props.modelValue || [])]
  next.splice(idx, 1)
  emitList(next.length ? next : [createDefaultSwitchCase()])
}

function patch(idx: number, part: Partial<SwitchCaseRow>) {
  const next = (props.modelValue || []).map((row, i) =>
    i === idx ? { ...row, ...part } : row,
  )
  if (part.value !== undefined || part.type !== undefined) {
    const key = switchCaseKey(next[idx]?.value)
    if (key) {
      const dup = next.findIndex(
        (r, i) => i !== idx && switchCaseKey(r.value) === key,
      )
      if (dup >= 0) {
        ElMessage.warning(t('forms.switch.duplicateValue', { value: key }))
        return
      }
    }
  }
  emitList(next)
}

function onTypeChange(idx: number, typ: SwitchCaseValueType) {
  let value: string | number | boolean = ''
  if (typ === 'number') value = 0
  else if (typ === 'boolean') value = false
  else value = ''
  patch(idx, { type: typ, value })
}

function boolValue(row: SwitchCaseRow) {
  return row.value === true || row.value === 'true' || row.value === 1
}

function numberValue(row: SwitchCaseRow) {
  const n = Number(row.value)
  return Number.isFinite(n) ? n : 0
}
</script>

<template>
  <div class="case-list">
    <div
      v-for="(row, idx) in modelValue || []"
      :key="idx"
      class="case-list__row"
    >
      <el-input
        v-if="row.type === 'string'"
        :model-value="String(row.value ?? '')"
        class="case-list__value"
        :placeholder="t('forms.switch.valuePlaceholder')"
        @update:model-value="(v: string) => patch(idx, { value: v })"
      />
      <el-input-number
        v-else-if="row.type === 'number'"
        :model-value="numberValue(row)"
        class="case-list__value"
        controls-position="right"
        @update:model-value="(v: number | undefined) => patch(idx, { value: v ?? 0 })"
      />
      <el-switch
        v-else
        :model-value="boolValue(row)"
        class="case-list__value case-list__value--bool"
        @update:model-value="(v: boolean) => patch(idx, { value: v })"
      />

      <el-select
        :model-value="row.type"
        class="case-list__type"
        @update:model-value="(v: SwitchCaseValueType) => onTypeChange(idx, v)"
      >
        <el-option
          v-for="opt in typeOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <el-input
        :model-value="row.name"
        class="case-list__name"
        :placeholder="t('forms.switch.nameOptional')"
        clearable
        @update:model-value="(v: string) => patch(idx, { name: v })"
      />

      <el-button
        :icon="Delete"
        text
        type="danger"
        :title="t('common.delete')"
        @click="removeRow(idx)"
      />
    </div>

    <el-button :icon="Plus" text type="primary" @click="addRow">
      {{ t('forms.switch.addCase') }}
    </el-button>
    <div class="case-list__hint">{{ t('forms.switch.casesHint') }}</div>
  </div>
</template>

<style scoped>
.case-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.case-list__row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.case-list__value {
  flex: 1 1 32%;
  min-width: 0;
}
.case-list__value--bool {
  flex: 0 0 auto;
  padding: 0 4px;
}
.case-list__type {
  flex: 0 0 96px;
  width: 96px;
}
.case-list__name {
  flex: 1 1 28%;
  min-width: 0;
}
.case-list__hint {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.45;
}
</style>
