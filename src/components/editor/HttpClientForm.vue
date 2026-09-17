<script setup lang="ts">
/**
 * HTTP 客户端节点属性：方法、URL、请求头、请求体、超时、调试测试值。
 * debugValue 仅节点「运行」时作为实际请求体（不走 body 模板）；真实部署不读。
 */
import { reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Delete, MagicStick } from '@element-plus/icons-vue'
import CodeBlockField from '@/components/common/CodeBlockField.vue'

/** 请求头一行 */
export interface HttpClientHeaderRow {
  name: string
  value: string
}

export interface HttpClientFormModel {
  method: string
  url: string
  headers: HttpClientHeaderRow[]
  body: string
  timeoutSec: number
  /** 仅节点「运行」时作为实际请求体的 JSON */
  debugValue: string
}

const props = defineProps<{
  modelValue: HttpClientFormModel
}>()

const emit = defineEmits<{
  'update:modelValue': [v: HttpClientFormModel]
  change: []
}>()

const { t } = useI18n()

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']

const local = reactive<HttpClientFormModel>({
  method: 'POST',
  url: '',
  headers: [],
  body: '',
  timeoutSec: 10,
  debugValue: '{\n  \n}',
})

const bodyRef = useTemplateRef<InstanceType<typeof CodeBlockField>>('bodyRef')
const debugRef = useTemplateRef<InstanceType<typeof CodeBlockField>>('debugRef')
const bodyFormatting = ref(false)
const debugFormatting = ref(false)

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    local.method = (v.method || 'POST').toUpperCase()
    local.url = v.url || ''
    local.headers = (v.headers || []).map((h) => ({
      name: h.name || '',
      value: h.value || '',
    }))
    local.body = v.body || ''
    local.timeoutSec = Number(v.timeoutSec) > 0 ? Number(v.timeoutSec) : 10
    local.debugValue = v.debugValue || '{\n  \n}'
  },
  { immediate: true, deep: true },
)

function emitUp() {
  emit('update:modelValue', {
    method: (local.method || 'POST').toUpperCase(),
    url: (local.url || '').trim(),
    headers: local.headers.map((h) => ({
      name: (h.name || '').trim(),
      value: h.value || '',
    })),
    body: local.body || '',
    timeoutSec: Number(local.timeoutSec) > 0 ? Number(local.timeoutSec) : 10,
    debugValue: local.debugValue || '{}',
  })
  emit('change')
}

function addHeader() {
  local.headers.push({ name: '', value: '' })
  emitUp()
}

function removeHeader(i: number) {
  local.headers.splice(i, 1)
  emitUp()
}

function onBodyUpdate(v: string) {
  local.body = v
  emitUp()
}

function onDebugUpdate(v: string) {
  local.debugValue = v
  emitUp()
}

async function formatBody() {
  if (!bodyRef.value?.format) return
  bodyFormatting.value = true
  try {
    await bodyRef.value.format()
  } finally {
    bodyFormatting.value = false
  }
}

async function formatDebug() {
  if (!debugRef.value?.format) return
  debugFormatting.value = true
  try {
    await debugRef.value.format()
  } finally {
    debugFormatting.value = false
  }
}
</script>

<template>
  <div class="http-client-form">
    <el-form-item :label="t('forms.httpClient.method')">
      <el-select
        v-model="local.method"
        style="width: 100%"
        @change="emitUp"
      >
        <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
      </el-select>
    </el-form-item>

    <el-form-item :label="t('forms.httpClient.url')">
      <el-input
        v-model="local.url"
        placeholder="https://api.example.com/path"
        clearable
        @change="emitUp"
      />
      <div class="hint">
        {{ t('forms.httpClient.urlTemplateHint') }}
      </div>
    </el-form-item>

    <el-form-item :label="t('forms.httpClient.timeout')">
      <el-input-number
        v-model="local.timeoutSec"
        :min="1"
        :max="300"
        controls-position="right"
        style="width: 100%"
        @change="emitUp"
      />
    </el-form-item>

    <el-form-item :label="t('forms.httpClient.headers')">
      <div class="headers">
        <div
          v-for="(h, i) in local.headers"
          :key="i"
          class="headers__row"
        >
          <el-input
            v-model="h.name"
            :placeholder="t('forms.httpClient.headerName')"
            size="small"
            @change="emitUp"
          />
          <el-input
            v-model="h.value"
            :placeholder="t('forms.httpClient.headerValue')"
            size="small"
            @change="emitUp"
          />
          <button
            class="headers__del"
            type="button"
            :title="t('common.delete')"
            @click="removeHeader(i)"
          >
            <el-icon><Delete /></el-icon>
          </button>
        </div>
        <el-button size="small" :icon="Plus" @click="addHeader">
          {{ t('forms.httpClient.addHeader') }}
        </el-button>
      </div>
    </el-form-item>

    <div
      v-if="local.method !== 'GET' && local.method !== 'HEAD'"
      class="code-field"
    >
      <div class="code-field__head">
        <span class="code-field__label">{{ t('forms.httpClient.body') }}</span>
        <el-tooltip :content="t('common.format')" placement="top" :show-after="300">
          <button
            type="button"
            class="code-field__btn"
            :aria-label="t('common.format')"
            :disabled="bodyFormatting"
            @click="formatBody"
          >
            <el-icon :size="14"><MagicStick /></el-icon>
          </button>
        </el-tooltip>
      </div>
      <CodeBlockField
        ref="bodyRef"
        :model-value="local.body"
        language="json"
        :show-toolbar="false"
        height="160px"
        :placeholder="t('forms.httpClient.bodyPlaceholder')"
        @update:model-value="onBodyUpdate"
      />
      <div class="hint">
        {{ t('forms.httpClient.bodyEmptyHint') }}<br />
        {{ t('forms.httpClient.bodyPlaceholderHint') }}
      </div>
    </div>

    <div class="code-field">
      <div class="code-field__head">
        <span class="code-field__label">{{ t('forms.httpClient.debugValue') }}</span>
        <el-tooltip :content="t('common.format')" placement="top" :show-after="300">
          <button
            type="button"
            class="code-field__btn"
            :aria-label="t('common.format')"
            :disabled="debugFormatting"
            @click="formatDebug"
          >
            <el-icon :size="14"><MagicStick /></el-icon>
          </button>
        </el-tooltip>
      </div>
      <CodeBlockField
        ref="debugRef"
        :model-value="local.debugValue"
        language="json"
        :show-toolbar="false"
        height="160px"
        placeholder='{"hello":"world"}'
        @update:model-value="onDebugUpdate"
      />
      <div class="hint">
        {{ t('forms.httpClient.debugRunHint') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-field {
  margin-bottom: 14px;
}
.code-field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.code-field__label {
  font-size: 12px;
  color: #606266;
  line-height: 22px;
}
.code-field__btn {
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.code-field__btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: #2563eb;
}
.code-field__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
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
  padding: 0 3px;
  border-radius: 3px;
}
.headers {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.headers__row {
  display: grid;
  grid-template-columns: 1fr 1fr 28px;
  gap: 4px;
  align-items: center;
}
.headers__del {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  color: #888;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.headers__del:hover {
  color: #c45656;
  border-color: #e0a0a0;
}
</style>
