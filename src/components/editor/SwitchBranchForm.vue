<script setup lang="ts">
/**
 * SWITCH 分支节点属性：取值表达式 + cases 列表。
 */
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { defaultSwitchCases } from '@/canvas/useBranchEdges'
import { Plus, Delete } from '@element-plus/icons-vue'

export interface SwitchCaseRow {
  value: string
  name?: string
}

export interface SwitchBranchFormModel {
  expression: string
  cases: SwitchCaseRow[]
}

const props = defineProps<{
  modelValue: SwitchBranchFormModel
}>()

const emit = defineEmits<{
  'update:modelValue': [v: SwitchBranchFormModel]
  change: []
}>()

const { t } = useI18n()

const local = reactive<SwitchBranchFormModel>({
  expression: 'msgType',
  cases: defaultSwitchCases(),
})

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    local.expression = v.expression || 'msgType'
    local.cases = (v.cases?.length ? v.cases : [{ value: 'a', name: '' }]).map(
      (c) => ({
        value: c.value || '',
        name: c.name || '',
      }),
    )
  },
  { immediate: true, deep: true },
)

function emitUp() {
  emit('update:modelValue', {
    expression: (local.expression || '').trim() || 'msgType',
    cases: local.cases.map((c) => ({
      value: (c.value || '').trim(),
      name: (c.name || '').trim(),
    })),
  })
  emit('change')
}

function addCase() {
  local.cases.push({ value: '', name: '' })
  emitUp()
}

function removeCase(i: number) {
  local.cases.splice(i, 1)
  if (!local.cases.length) {
    local.cases.push({ value: 'a', name: '' })
  }
  emitUp()
}
</script>

<template>
  <div class="sw-form">
    <el-form-item :label="t('forms.switch.expressionLabel')">
      <el-input
        v-model="local.expression"
        placeholder="msg.action"
        @change="emitUp"
      />
      <div class="hint">
        {{ t('forms.switch.expressionHint') }}
      </div>
    </el-form-item>
    <el-form-item :label="t('forms.switch.casesLabel')">
      <div class="cases">
        <div v-for="(c, i) in local.cases" :key="i" class="case-row">
          <el-input
            v-model="c.value"
            class="cell-value"
            placeholder="value"
            @change="emitUp"
          />
          <el-input
            v-model="c.name"
            class="cell-name"
            :placeholder="t('forms.switch.nameOptional')"
            clearable
            @change="emitUp"
          />
          <el-button
            :icon="Delete"
            text
            type="danger"
            :title="t('common.delete')"
            @click="removeCase(i)"
          />
        </div>
        <el-button :icon="Plus" text type="primary" @click="addCase">
          {{ t('forms.switch.addCase') }}
        </el-button>
        <div class="hint">{{ t('forms.switch.casesHint') }}</div>
      </div>
    </el-form-item>
  </div>
</template>

<style scoped>
.hint {
  margin-top: 6px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.45;
}
.hint code {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 0 4px;
  border-radius: 3px;
}
.cases {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.case-row {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
}
.cell-value {
  flex: 1 1 40%;
  min-width: 0;
}
.cell-name {
  flex: 1 1 40%;
  min-width: 0;
}
</style>
