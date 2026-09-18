<script setup lang="ts">
/**
 * 按后端 ConfigFields 动态渲染节点 configuration 表单。
 */
import { computed, reactive, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConfigField } from '@/types/flow'
import type { LfInstance } from '@/canvas/lf-types'
import DynamicCodeField from './DynamicCodeField.vue'
import RouterListField from './RouterListField.vue'
import GlobalVarListField from './GlobalVarListField.vue'
import SwitchCaseListField from './SwitchCaseListField.vue'
import BranchListField from './BranchListField.vue'
import type { GlobalVarItem } from './globalVarList'
import type { SwitchCaseRow } from './switchCaseList'
import type { BranchRow } from './branchList'
import {
  readFieldDisplayValue,
  writeFieldValue,
} from './configDefaults'
import { resolveWidget } from './resolveWidget'
import { matchShowIf } from './showIf'
import type { HttpRouterItem } from '@/canvas/httpRouter'
import HttpResponseTemplateBar from '../HttpResponseTemplateBar.vue'
import { collectFlowGlobalNames } from '@/components/common/collectFlowGlobalNames'
import { collectFlowBranchNames } from '@/components/common/collectFlowBranchNames'
import { listMqttInOptions } from './mqttInOptions'

const props = defineProps<{
  fields: ConfigField[]
  /** 当前节点 configuration */
  modelValue: Record<string, unknown>
  /** 节点 type，用于 HTTP 响应体模板等特化 */
  nodeType?: string
  /** 当前编辑节点 id（mqtt-in-ref 排除自身） */
  nodeId?: string | null
  /** 画布实例：用于收集本流程 globalVars 补全 */
  lf?: LfInstance | null
}>()

const emit = defineEmits<{
  'update:modelValue': [v: Record<string, unknown>]
}>()

const { t } = useI18n()

/** 表单展示态（代码类为字符串；router-list 为对象数组） */
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
  // 路由列表不用后端 schema 说明当标签，改用本地化短标题
  if (resolveWidget(f) === 'router-list') {
    return t('forms.httpEndpoint.routers')
  }
  if (resolveWidget(f) === 'var-list') {
    return t('forms.globalVars.listLabel')
  }
  if (resolveWidget(f) === 'case-list') {
    return t('forms.switch.casesLabel')
  }
  if (resolveWidget(f) === 'branch-list') {
    return t('forms.branchListLabel')
  }
  return (f.description || '').trim() || f.name
}

/** IF / Switch 表达式：优先本地化说明（标明 Go expr） */
function fieldHint(f: ConfigField): string | undefined {
  if (f.name === 'expression' && props.nodeType === 'if') {
    return t('forms.if.hint')
  }
  if (f.name === 'expression' && props.nodeType === 'switch') {
    return t('forms.switch.expressionHint')
  }
  return (f.hint || '').trim() || undefined
}

/** Go expr 字段禁用 JS 格式化，避免破坏表达式 */
function isGoExprField(f: ConfigField): boolean {
  return (
    f.name === 'expression' &&
    (props.nodeType === 'if' || props.nodeType === 'switch')
  )
}

/** 本流程已声明的 global 变量名（供代码补全） */
const flowGlobalNames = computed(() => collectFlowGlobalNames(props.lf))

/** 本流程并发分组线路名（供 msg.branches.xxx 补全） */
const flowBranchNames = computed(() => collectFlowBranchNames(props.lf))

/** 画布中可复用的 MQTT 收节点 */
const mqttInOptions = computed(() => listMqttInOptions(props.lf, props.nodeId))

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

function onSelectChange(f: ConfigField, v: string) {
  local[f.name] = v
  emitUp()
}

function onCodeUpdate(f: ConfigField, v: string) {
  local[f.name] = v
  emitUp()
}

/** 路由列表结构化编辑写回（始终为对象数组，不再走 JSON 文本） */
function onRouterListUpdate(f: ConfigField, v: HttpRouterItem[]) {
  local[f.name] = v
  emitUp()
}

/** 全局变量列表写回 */
function onVarListUpdate(f: ConfigField, v: GlobalVarItem[]) {
  local[f.name] = v
  emitUp()
}

/** SWITCH cases 列表写回 */
function onCaseListUpdate(f: ConfigField, v: SwitchCaseRow[]) {
  local[f.name] = v
  emitUp()
}

/** 并发分组线路列表写回 */
function onBranchListUpdate(f: ConfigField, v: BranchRow[]) {
  local[f.name] = v
  emitUp()
}

/** HTTP 响应 body 字段展示预设模板下拉 */
function isHttpResponseBody(f: ConfigField) {
  return props.nodeType === 'httpResponse' && f.name === 'body'
}

function onHttpResponseTemplateApply(v: { statusCode: number; body: string }) {
  local.statusCode = v.statusCode
  local.body = v.body
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
        <div class="select-with-hint">
          <el-input-number
            :model-value="Number(local[f.name]) || 0"
            :controls="true"
            @update:model-value="(v: number | undefined) => onNumberChange(f, v)"
          />
          <span v-if="f.hint" class="switch-hint">{{ f.hint }}</span>
        </div>
      </el-form-item>

      <el-form-item
        v-else-if="resolveWidget(f) === 'select'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <div class="select-with-hint">
          <el-select
            :model-value="String(local[f.name] ?? '')"
            filterable
            style="width: 100%"
            @update:model-value="(v: string) => onSelectChange(f, v)"
          >
            <el-option
              v-for="opt in f.options || []"
              :key="opt.value"
              :label="opt.label || opt.value"
              :value="opt.value"
            />
          </el-select>
          <span v-if="f.hint" class="switch-hint">{{ f.hint }}</span>
        </div>
      </el-form-item>

      <el-form-item
        v-else-if="resolveWidget(f) === 'mqtt-in-ref'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <div class="select-with-hint">
          <el-select
            :model-value="String(local[f.name] ?? '')"
            clearable
            filterable
            style="width: 100%"
            :placeholder="t('forms.mqttOut.reuseNone')"
            @update:model-value="(v: string | null) => onSelectChange(f, v || '')"
          >
            <el-option
              :label="t('forms.mqttOut.reuseNone')"
              value=""
            />
            <el-option
              v-for="opt in mqttInOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
          <span v-if="f.hint" class="switch-hint">{{ f.hint }}</span>
        </div>
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

      <el-form-item
        v-else-if="resolveWidget(f) === 'router-list'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <RouterListField
          :model-value="local[f.name]"
          @update:model-value="(v) => onRouterListUpdate(f, v)"
        />
      </el-form-item>

      <el-form-item
        v-else-if="resolveWidget(f) === 'var-list'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <GlobalVarListField
          :model-value="(local[f.name] as GlobalVarItem[]) || []"
          @update:model-value="(v) => onVarListUpdate(f, v)"
        />
      </el-form-item>

      <el-form-item
        v-else-if="resolveWidget(f) === 'case-list'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <SwitchCaseListField
          :model-value="(local[f.name] as SwitchCaseRow[]) || []"
          @update:model-value="(v) => onCaseListUpdate(f, v)"
        />
      </el-form-item>

      <el-form-item
        v-else-if="resolveWidget(f) === 'branch-list'"
        :label="fieldLabel(f)"
        :required="f.required"
      >
        <BranchListField
          :model-value="local[f.name]"
          @update:model-value="(v) => onBranchListUpdate(f, v)"
        />
        <div v-if="f.hint" class="branch-hint">{{ f.hint }}</div>
      </el-form-item>

      <DynamicCodeField
        v-else-if="resolveWidget(f) === 'code-json' || resolveWidget(f) === 'code-js'"
        ref="codeRefs"
        :label="fieldLabel(f)"
        :model-value="String(local[f.name] ?? '')"
        :language="codeLanguage(f)"
        :height="codeHeight(f)"
        :hint="fieldHint(f)"
        :enable-format="!isGoExprField(f)"
        :global-names="flowGlobalNames"
        :branch-names="flowBranchNames"
        @update:model-value="(v) => onCodeUpdate(f, v)"
      >
        <template v-if="isHttpResponseBody(f)" #below-head>
          <HttpResponseTemplateBar
            :status-code="Number(local.statusCode) || 200"
            :body="String(local.body ?? '')"
            @apply="onHttpResponseTemplateApply"
          />
        </template>
      </DynamicCodeField>

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
.switch-with-hint,
.select-with-hint {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
.switch-with-hint {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.switch-hint {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.35;
}
.branch-hint {
  margin-top: 6px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.35;
}
</style>
