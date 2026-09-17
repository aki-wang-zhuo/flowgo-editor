<script setup lang="ts">
/**
 * 注入执行：JSON payload 代码编辑（格式化 / 最大化）。
 */
import { reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick, FullScreen, Close } from '@element-plus/icons-vue'
import CodeBlockField from '@/components/common/CodeBlockField.vue'

export interface InjectFormModel {
  payload: string
}

const props = defineProps<{
  modelValue: InjectFormModel
}>()

const emit = defineEmits<{
  'update:modelValue': [v: InjectFormModel]
  change: []
}>()

const { t } = useI18n()

const local = reactive<InjectFormModel>({
  payload: '{}',
})

const editorRef = useTemplateRef<InstanceType<typeof CodeBlockField>>('editorRef')
const maxEditorRef =
  useTemplateRef<InstanceType<typeof CodeBlockField>>('maxEditorRef')
const maximized = ref(false)
const formatting = ref(false)

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    local.payload = v.payload || '{}'
  },
  { immediate: true, deep: true },
)

function onUpdate(v: string) {
  local.payload = v
  emit('update:modelValue', {
    payload: (v || '').trim() || '{}',
  })
  emit('change')
}

async function onFormat() {
  const editor = maximized.value ? maxEditorRef.value : editorRef.value
  if (!editor?.format) return
  formatting.value = true
  try {
    await editor.format()
  } finally {
    formatting.value = false
  }
}

function openMaximize() {
  maximized.value = true
}

function closeMaximize() {
  maximized.value = false
}

defineExpose({ closeMaximize })
</script>

<template>
  <div class="inject-form">
    <div class="inject-form__head">
      <span class="inject-form__label">{{ t('forms.inject.payloadLabel') }}</span>
      <div class="inject-form__actions">
        <el-tooltip :content="t('common.format')" placement="top" :show-after="300">
          <button
            type="button"
            class="inject-form__icon-btn"
            :aria-label="t('common.format')"
            :disabled="formatting"
            @click="onFormat"
          >
            <el-icon :size="14"><MagicStick /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip :content="t('common.maximize')" placement="top" :show-after="300">
          <button
            type="button"
            class="inject-form__icon-btn"
            :aria-label="t('common.maximize')"
            @click="openMaximize"
          >
            <el-icon :size="14"><FullScreen /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>
    <div class="field-hint">
      {{ t('forms.inject.hint') }}
    </div>
    <CodeBlockField
      ref="editorRef"
      :model-value="local.payload"
      language="json"
      :show-toolbar="false"
      height="200px"
      placeholder="{}"
      @update:model-value="onUpdate"
    />

    <Teleport to="body">
      <div
        v-if="maximized"
        class="inject-max"
        role="dialog"
        :aria-label="t('forms.inject.maximizeAria')"
      >
        <div class="inject-max__bar">
          <span class="inject-max__title">{{ t('forms.inject.maximizeTitle') }}</span>
          <div class="inject-max__actions">
            <el-tooltip :content="t('common.format')" placement="bottom" :show-after="300">
              <button
                type="button"
                class="inject-max__icon-btn"
                :aria-label="t('common.format')"
                :disabled="formatting"
                @click="onFormat"
              >
                <el-icon :size="16"><MagicStick /></el-icon>
              </button>
            </el-tooltip>
            <el-tooltip :content="t('common.exitMaximize')" placement="bottom" :show-after="300">
              <button
                type="button"
                class="inject-max__icon-btn"
                :aria-label="t('common.exitMaximize')"
                @click="closeMaximize"
              >
                <el-icon :size="16"><Close /></el-icon>
              </button>
            </el-tooltip>
          </div>
        </div>
        <div class="inject-max__body">
          <CodeBlockField
            ref="maxEditorRef"
            :model-value="local.payload"
            language="json"
            :show-toolbar="false"
            maximized
            height="100%"
            placeholder="{}"
            @update:model-value="onUpdate"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.inject-form {
  margin-bottom: 18px;
}
.inject-form__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.inject-form__label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 22px;
}
.inject-form__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.inject-form__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}
.inject-form__icon-btn:hover:not(:disabled) {
  color: #2563eb;
  background: #f1f5f9;
}
.inject-form__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.field-hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.5;
}
</style>

<style>
.inject-max {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  flex-direction: column;
  background: #0f172a;
}
.inject-max__bar {
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  color: #e2e8f0;
}
.inject-max__title {
  font-size: 14px;
  font-weight: 600;
}
.inject-max__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.inject-max__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
}
.inject-max__icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.inject-max__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.inject-max__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.inject-max__body .fg-code-block {
  flex: 1;
  height: 100%;
}
</style>
