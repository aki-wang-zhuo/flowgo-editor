<script setup lang="ts">
/**
 * IF 分支条件表达式：CodeMirror 编辑 + 最大化（Go expr 布尔式）。
 */
import { reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick, FullScreen, Close } from '@element-plus/icons-vue'
import CodeBlockField from '@/components/common/CodeBlockField.vue'

export interface IfBranchFormModel {
  expression: string
}

const props = defineProps<{
  modelValue: IfBranchFormModel
}>()

const emit = defineEmits<{
  'update:modelValue': [v: IfBranchFormModel]
  change: []
}>()

const { t } = useI18n()

const local = reactive<IfBranchFormModel>({
  expression: 'true',
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
    local.expression = v.expression || 'true'
  },
  { immediate: true, deep: true },
)

function onUpdate(v: string) {
  local.expression = v
  emit('update:modelValue', {
    expression: (v || '').trim() || 'true',
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

/** 父级切换节点时关闭全屏 */
defineExpose({ closeMaximize })
</script>

<template>
  <div class="if-form">
    <div class="if-form__head">
      <span class="if-form__label">{{ t('forms.if.expressionLabel') }}</span>
      <div class="if-form__actions">
        <el-tooltip :content="t('common.format')" placement="top" :show-after="300">
          <button
            type="button"
            class="if-form__icon-btn"
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
            class="if-form__icon-btn"
            :aria-label="t('common.maximize')"
            @click="openMaximize"
          >
            <el-icon :size="14"><FullScreen /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>
    <div class="field-hint">
      {{ t('forms.if.hint') }}
    </div>
    <CodeBlockField
      ref="editorRef"
      :model-value="local.expression"
      language="javascript"
      :show-toolbar="false"
      height="160px"
      placeholder="msg.status == 200"
      @update:model-value="onUpdate"
    />

    <Teleport to="body">
      <div
        v-if="maximized"
        class="if-max"
        role="dialog"
        :aria-label="t('forms.if.maximizeAria')"
      >
        <div class="if-max__bar">
          <span class="if-max__title">{{ t('forms.if.maximizeTitle') }}</span>
          <div class="if-max__actions">
            <el-tooltip :content="t('common.format')" placement="bottom" :show-after="300">
              <button
                type="button"
                class="if-max__icon-btn"
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
                class="if-max__icon-btn"
                :aria-label="t('common.exitMaximize')"
                @click="closeMaximize"
              >
                <el-icon :size="16"><Close /></el-icon>
              </button>
            </el-tooltip>
          </div>
        </div>
        <div class="if-max__body">
          <CodeBlockField
            ref="maxEditorRef"
            :model-value="local.expression"
            language="javascript"
            :show-toolbar="false"
            maximized
            height="100%"
            placeholder="msg.status == 200"
            @update:model-value="onUpdate"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.if-form {
  margin-bottom: 18px;
}
.if-form__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.if-form__label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 22px;
}
.if-form__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.if-form__icon-btn {
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
.if-form__icon-btn:hover:not(:disabled) {
  color: #2563eb;
  background: #f1f5f9;
}
.if-form__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.field-hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.5;
}
.field-hint code {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 0 4px;
  border-radius: 3px;
}
</style>

<style>
.if-max {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  flex-direction: column;
  background: #0f172a;
}
.if-max__bar {
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  color: #e2e8f0;
}
.if-max__title {
  font-size: 14px;
  font-weight: 600;
}
.if-max__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.if-max__icon-btn {
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
.if-max__icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.if-max__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.if-max__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.if-max__body .fg-code-block {
  flex: 1;
  height: 100%;
}
</style>
