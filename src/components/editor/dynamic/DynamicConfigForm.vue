<script setup lang="ts">
/**
 * 按后端 ConfigFields 动态渲染节点 configuration 表单。
 */
import { computed, reactive, useTemplateRef, watch } from 'vue'
import type { ConfigField } from '@/types/flow'
import DynamicCodeField from './DynamicCodeField.vue'
import {
  readFieldDisplayValue,
  writeFieldValue,
} from './configDefaults'
import { resolveWidget } from './resolveWidget'
import { matchShowIf } from './showIf'

const props = defineProps<{
  fields: ConfigField[]
  /** 当前节点 configuration */
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [v: Record<string, unknown>]
}>()

/** 表单展示态（代码类为字符串） */
const local = reactive<Record<string, unknown>>({})

const codeRefs = useTemplateRef<InstanceType<typeof DynamicCodeField>[]>('codeRefs')

watch(
  () => [props.fields, props.modelValue] as const,
  () => {
    syncFromProps()
  },
  { immediate: true, deep: true },
)

function syncFromProps() {
  const next: Record<string, unknown> = {}
  for (const f of props.fields || []) {
    if (!f.name) continue
    next[f.name] = readFieldDisplayValue(f, props.modelValue || {})
  }
  for (const k of Object.keys(local)) {
    if (!(k in next)) delete local[k]
  }
  Object.assign(local, next)
}

/** 当前可见字段（考虑 showIf） */
const visibleFields = computed(() =>
  (props.fields || []).filter((f) => matchShowIf(f.showIf, local)),
)

function fieldLabel(f: ConfigField) {
  return (f.description || '').trim() || f.name
}

function codeLanguage(f: ConfigField): 'json' | 'javascript' | 'text' {
  const w = resolveWidget(f)
  if (w === 'code-js') return 'javascript'
  if (w === 'code-json') return 'json'
  return 'text'
}

function codeHeight(f: ConfigField) {
  const rows = f.rows && f.rows > 0 ? f.rows : 8
  return `${Math.max(120, rows * 22)}px`
}

/** 写回 configuration；隐藏字段清空；HTTPS 关闭时清 PEM */
function emitUp() {
  const out: Record<string, unknown> = { ...(props.modelValue || {}) }
  for (const f of props.fields || []) {
    if (!f.name) continue
    if (!matchShowIf(f.showIf, local)) {
      // 条件不满足：移除或置空，避免残留敏感值
      if (f.name === 'certPem' || f.name === 'keyPem') {
        out[f.name] = ''
      } else if (Object.prototype.hasOwnProperty.call(out, f.name)) {
        // 保留其它隐藏字段旧值（如将来扩展）；PEM 必须清
      }
      continue
    }
    out[f.name] = writeFieldValue(f, local[f.name])
  }
  emit('update:modelValue', out)
}

function onSwitchChange(f: ConfigField, v: boolean) {
  local[f.name] = v
  emitUp()
}

function onTextChange() {
  emitUp()
}

function onNumberChange(f: ConfigField, v: number | undefined) {
  local[f.name] = v ?? 0
  emitUp()
}

function onCodeUpdate(f: ConfigField, v: string) {
  local[f.name] = v
  emitUp()
}

/** 父级切换节点时关闭全屏 */
function closeMaximize() {
  const list = codeRefs.value
  if (!list) return
  for (const c of list) {
    c?.closeMaximize?.()
  }
}

defineExpose({ closeMaximize })
</script>

<template>
  <div class="dyn-form">
    <template v-for="f in visibleFields" :key="f.name">
      <!-- 开关：标签 + 同行提示（description 已作标签时不再重复） -->
      <el-form-item
        v-if="resolveWidget(f) === 'switch'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <div class="switch-with-hint">
          <el-switch
            :model-value="!!local[f.name]"
            @change="(v: boolean) => onSwitchChange(f, v)"
          />
          <span v-if="f.hint" class="switch-hint">{{ f.hint }}</span>
        </div>
      </el-form-item>

      <el-form-item
        v-else-if="resolveWidget(f) === 'number'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <el-input-number
          :model-value="Number(local[f.name]) || 0"
          :controls="true"
          @update:model-value="(v: number | undefined) => onNumberChange(f, v)"
        />
      </el-form-item>

      <el-form-item
        v-else-if="resolveWidget(f) === 'textarea'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <el-input
          :model-value="String(local[f.name] ?? '')"
          type="textarea"
          :rows="f.rows && f.rows > 0 ? f.rows : 4"
          @update:model-value="(v: string) => (local[f.name] = v)"
          @change="onTextChange"
        />
      </el-form-item>

      <DynamicCodeField
        v-else-if="resolveWidget(f) === 'code-json' || resolveWidget(f) === 'code-js'"
        ref="codeRefs"
        :label="fieldLabel(f)"
        :model-value="String(local[f.name] ?? '')"
        :language="codeLanguage(f)"
        :height="codeHeight(f)"
        @update:model-value="(v) => onCodeUpdate(f, v)"
      />

      <el-form-item v-else :label="fieldLabel(f)" :required="f.required">
        <el-input
          :model-value="String(local[f.name] ?? '')"
          @update:model-value="(v: string) => (local[f.name] = v)"
          @change="onTextChange"
        />
      </el-form-item>
    </template>
  </div>
</template>

<style scoped>
.switch-with-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}
.switch-hint {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.35;
}
</style>
