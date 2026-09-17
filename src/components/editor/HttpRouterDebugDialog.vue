<script setup lang="ts">
/**
 * 单条请求路径的调试值编辑（JSON 代码编辑器，仅调试用，真实请求不使用）。
 * 说明行右侧提供格式化图标按钮。
 */
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick } from '@element-plus/icons-vue'
import CodeBlockField from '@/components/common/CodeBlockField.vue'
import { formatJsonLoose } from '@/utils/formatJson'

const props = defineProps<{
  modelValue: boolean
  /** 路径展示标题 */
  title: string
  /** 初始 JSON 文本 */
  value: string
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  confirm: [jsonText: string]
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const text = ref('{}')
const error = ref('')
const formatting = ref(false)
const editorRef =
  useTemplateRef<InstanceType<typeof CodeBlockField>>('editorRef')

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const raw = (props.value || '').trim()
    text.value = raw || '{\n  \n}'
    error.value = ''
  },
)

function validate(): boolean {
  const raw = text.value.trim()
  if (!raw) {
    text.value = '{}'
    error.value = ''
    return true
  }
  const pretty = formatJsonLoose(raw)
  if (!pretty.ok) {
    error.value = t('forms.httpDebug.invalidJson')
    return false
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(pretty.text)
  } catch {
    error.value = t('forms.httpDebug.invalidJson')
    return false
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    error.value = t('forms.httpDebug.needObject')
    return false
  }
  text.value = pretty.text
  error.value = ''
  return true
}

async function onFormat() {
  if (!editorRef.value?.format) return
  formatting.value = true
  error.value = ''
  try {
    const ok = await editorRef.value.format()
    if (!ok) {
      error.value = t('forms.formatJsonError')
    }
  } finally {
    formatting.value = false
  }
}

function onConfirm() {
  if (!validate()) return
  emit('confirm', text.value.trim() || '{}')
  visible.value = false
}

function onCancel() {
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('forms.httpDebug.title', { title })"
    width="560px"
    append-to-body
    destroy-on-close
    @closed="error = ''"
  >
    <div class="hint-row">
      <p class="hint">
        {{ t('forms.httpDebug.description') }}
      </p>
      <el-tooltip :content="t('common.format')" placement="top" :show-after="300">
        <button
          type="button"
          class="hint-row__icon-btn"
          :aria-label="t('common.format')"
          :disabled="formatting"
          @click="onFormat"
        >
          <el-icon :size="14"><MagicStick /></el-icon>
        </button>
      </el-tooltip>
    </div>
    <CodeBlockField
      ref="editorRef"
      v-model="text"
      language="json"
      :show-toolbar="false"
      height="240px"
      placeholder='{ "id": 1 }'
    />
    <p v-if="error" class="err">{{ error }}</p>
    <template #footer>
      <el-button @click="onCancel">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="onConfirm">{{ t('common.ok') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 10px;
}
.hint {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.45;
}
.hint-row__icon-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-top: -1px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}
.hint-row__icon-btn:hover:not(:disabled) {
  color: #2563eb;
  background: #f1f5f9;
}
.hint-row__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.err {
  margin: 8px 0 0;
  font-size: 12px;
  color: #dc2626;
}
</style>
