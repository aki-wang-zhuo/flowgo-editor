<script setup lang="ts">
/**
 * HTTP 响应节点属性：状态码 + 响应体模板（标题行格式化按钮）。
 */
import { reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick } from '@element-plus/icons-vue'
import CodeBlockField from '@/components/common/CodeBlockField.vue'

export interface HttpResponseFormModel {
  statusCode: number
  body: string
}

const props = defineProps<{
  modelValue: HttpResponseFormModel
}>()

const emit = defineEmits<{
  'update:modelValue': [v: HttpResponseFormModel]
  change: []
}>()

const { t } = useI18n()

const local = reactive<HttpResponseFormModel>({
  statusCode: 200,
  body: '',
})

const bodyRef = useTemplateRef<InstanceType<typeof CodeBlockField>>('bodyRef')
const formatting = ref(false)

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    local.statusCode = Number(v.statusCode) || 200
    local.body = v.body || ''
  },
  { immediate: true, deep: true },
)

function emitUp() {
  emit('update:modelValue', {
    statusCode: Number(local.statusCode) || 200,
    body: local.body,
  })
  emit('change')
}

function onBodyUpdate(v: string) {
  local.body = v
  emitUp()
}

async function onFormat() {
  if (!bodyRef.value?.format) return
  formatting.value = true
  try {
    await bodyRef.value.format()
  } finally {
    formatting.value = false
  }
}
</script>

<template>
  <div class="http-resp-form">
    <el-form-item :label="t('forms.httpResponse.statusCode')">
      <el-input-number
        v-model="local.statusCode"
        :min="100"
        :max="599"
        controls-position="right"
        style="width: 100%"
        @change="emitUp"
      />
    </el-form-item>

    <div class="code-field">
      <div class="code-field__head">
        <span class="code-field__label">{{ t('forms.httpResponse.body') }}</span>
        <el-tooltip :content="t('common.format')" placement="top" :show-after="300">
          <button
            type="button"
            class="code-field__btn"
            :aria-label="t('common.format')"
            :disabled="formatting"
            @click="onFormat"
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
        height="200px"
        :placeholder="t('forms.httpResponse.bodyPlaceholder')"
        @update:model-value="onBodyUpdate"
      />
      <div class="hint">
        {{ t('forms.httpResponse.bodyEmptyHint') }}<br />
        {{ t('forms.httpResponse.templateHint') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-field {
  margin-bottom: 8px;
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
</style>
