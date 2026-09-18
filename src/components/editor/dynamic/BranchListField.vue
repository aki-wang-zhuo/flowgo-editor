<script setup lang="ts">
/**
 * 并发分组线路名列表编辑。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Delete } from '@element-plus/icons-vue'
import {
  parseBranchList,
  type BranchRow,
} from './branchList'

const props = defineProps<{
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [v: BranchRow[]]
}>()

const { t } = useI18n()

/** 编辑态保留空行；写回时由 writeFieldValue 再规范化 */
function currentRows(): BranchRow[] {
  if (Array.isArray(props.modelValue) && props.modelValue.length) {
    return (props.modelValue as BranchRow[]).map((r) => ({
      name: String(r?.name ?? ''),
    }))
  }
  const list = parseBranchList(props.modelValue)
  return list.length ? list : [{ name: '' }]
}

const rows = computed(() => currentRows())

function emitRows(next: BranchRow[]) {
  // 编辑过程中不去重删空，避免输入时行消失；仅保证至少一行
  emit('update:modelValue', next.length ? next : [{ name: '' }])
}

function updateRow(idx: number, name: string) {
  const next = currentRows().map((r, i) => (i === idx ? { name } : { ...r }))
  emitRows(next)
}

function addRow() {
  emitRows([...currentRows(), { name: '' }])
}

function removeRow(idx: number) {
  const next = currentRows().filter((_, i) => i !== idx)
  emitRows(next.length ? next : [{ name: '' }])
}
</script>

<template>
  <div class="branch-list">
    <div v-for="(row, idx) in rows" :key="idx" class="branch-list__row">
      <el-input
        :model-value="row.name"
        size="small"
        :placeholder="t('forms.branchNamePlaceholder')"
        @update:model-value="(v: string) => updateRow(idx, v)"
      />
      <el-button
        :icon="Delete"
        circle
        size="small"
        text
        type="danger"
        :disabled="rows.length <= 1"
        @click="removeRow(idx)"
      />
    </div>
    <el-button size="small" :icon="Plus" @click="addRow">
      {{ t('forms.branchAdd') }}
    </el-button>
  </div>
</template>

<style scoped>
.branch-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.branch-list__row {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
