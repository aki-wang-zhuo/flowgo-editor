<script setup lang="ts">
/**
 * JS 转换节点的 jsScript 编辑：标题行图标按钮（格式化 / 最大化）+ 入参说明 + 代码编辑器。
 */
import { ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick, FullScreen, Close } from '@element-plus/icons-vue'
import CodeBlockField from '@/components/common/CodeBlockField.vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [v: string]
  change: []
}>()

const { t } = useI18n()

const editorRef = useTemplateRef<InstanceType<typeof CodeBlockField>>('editorRef')
const maxEditorRef =
  useTemplateRef<InstanceType<typeof CodeBlockField>>('maxEditorRef')
const maximized = ref(false)
const formatting = ref(false)

watch(
  () => props.modelValue,
  () => {
    /* 切换节点时由父级重置 modelValue；关闭全屏避免串内容 */
  },
)

function onUpdate(v: string) {
  emit('update:modelValue', v)
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

/** 父级切换节点时可调用，关闭全屏 */
defineExpose({ closeMaximize })
</script>

<template>
  <div class="js-field">
    <div class="js-field__head">
      <span class="js-field__label">jsScript</span>
      <div class="js-field__actions">
        <el-tooltip :content="t('common.format')" placement="top" :show-after="300">
          <button
            type="button"
            class="js-field__icon-btn"
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
            class="js-field__icon-btn"
            :aria-label="t('common.maximize')"
            @click="openMaximize"
          >
            <el-icon :size="14"><FullScreen /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>
    <div class="field-hint">
      {{ t('forms.jsScript.hint') }}
    </div>
    <CodeBlockField
      ref="editorRef"
      :model-value="modelValue"
      language="javascript"
      :show-toolbar="false"
      height="280px"
      placeholder="return {'msg':msg,'metadata':metadata,'msgType':msgType,'dataType':dataType};"
      @update:model-value="onUpdate"
    />

    <Teleport to="body">
      <div
        v-if="maximized"
        class="js-max"
        role="dialog"
        :aria-label="t('forms.jsScript.maximizeAria')"
      >
        <div class="js-max__bar">
          <span class="js-max__title">jsScript</span>
          <div class="js-max__actions">
            <el-tooltip :content="t('common.format')" placement="bottom" :show-after="300">
              <button
                type="button"
                class="js-max__icon-btn"
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
                class="js-max__icon-btn"
                :aria-label="t('common.exitMaximize')"
                @click="closeMaximize"
              >
                <el-icon :size="16"><Close /></el-icon>
              </button>
            </el-tooltip>
          </div>
        </div>
        <div class="js-max__body">
          <CodeBlockField
            ref="maxEditorRef"
            :model-value="modelValue"
            language="javascript"
            :show-toolbar="false"
            maximized
            height="100%"
            placeholder="return {'msg':msg,'metadata':metadata,'msgType':msgType,'dataType':dataType};"
            @update:model-value="onUpdate"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.js-field {
  margin-bottom: 18px;
}
.js-field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.js-field__label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 22px;
}
.js-field__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.js-field__icon-btn {
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
.js-field__icon-btn:hover:not(:disabled) {
  color: #2563eb;
  background: #f1f5f9;
}
.js-field__icon-btn:disabled {
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
.js-max {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  flex-direction: column;
  background: #0f172a;
}
.js-max__bar {
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  color: #e2e8f0;
}
.js-max__title {
  font-size: 14px;
  font-weight: 600;
}
.js-max__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.js-max__icon-btn {
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
.js-max__icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.js-max__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.js-max__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.js-max__body .fg-code-block {
  flex: 1;
  height: 100%;
}
</style>
