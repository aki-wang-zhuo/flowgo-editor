<script setup lang="ts">
/**
 * 动态表单中的代码编辑字段：格式化 / 最大化。
 * 透传 globalNames 供 CodeBlockField 注入补全；enableFormat=false 用于 Go expr。
 */
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick, FullScreen, Close } from '@element-plus/icons-vue'
import CodeBlockField from '@/components/common/CodeBlockField.vue'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: string
    language: 'json' | 'javascript' | 'text'
    height?: string
    hint?: string
    /** 是否显示并允许格式化；Go expr 等应设为 false */
    enableFormat?: boolean
    /** 本流程 globalVars 变量名（不含 global. 前缀） */
    globalNames?: string[]
    /** 本流程 concurrentGroup 线路名 */
    branchNames?: string[]
  }>(),
  {
    enableFormat: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [v: string]
}>()

const { t } = useI18n()

const editorRef = useTemplateRef<InstanceType<typeof CodeBlockField>>('editorRef')
const maxEditorRef =
  useTemplateRef<InstanceType<typeof CodeBlockField>>('maxEditorRef')
const maximized = ref(false)
const formatting = ref(false)

function onUpdate(v: string) {
  emit('update:modelValue', v)
}

async function onFormat() {
  if (!props.enableFormat) return
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
  <div class="dyn-code">
    <div class="dyn-code__head">
      <span class="dyn-code__label">{{ label }}</span>
      <div class="dyn-code__actions">
        <el-tooltip
          v-if="enableFormat && (language === 'json' || language === 'javascript')"
          :content="t('common.format')"
          placement="top"
          :show-after="300"
        >
          <button
            type="button"
            class="dyn-code__icon-btn"
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
            class="dyn-code__icon-btn"
            :aria-label="t('common.maximize')"
            @click="openMaximize"
          >
            <el-icon :size="14"><FullScreen /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>
    <!-- 标题行下方扩展区（如 HTTP 响应模板选择） -->
    <div v-if="$slots['below-head']" class="dyn-code__below">
      <slot name="below-head" />
    </div>
    <div v-if="hint" class="dyn-code__hint">{{ hint }}</div>
    <CodeBlockField
      ref="editorRef"
      :model-value="modelValue"
      :language="language"
      :show-toolbar="false"
      :enable-format="enableFormat"
      :global-names="globalNames"
      :branch-names="branchNames"
      :height="height || '180px'"
      @update:model-value="onUpdate"
    />

    <Teleport to="body">
      <div
        v-if="maximized"
        class="dyn-code-max"
        role="dialog"
        :aria-label="label"
      >
        <div class="dyn-code-max__bar">
          <span class="dyn-code-max__title">{{ label }}</span>
          <div class="dyn-code-max__actions">
            <el-tooltip
              v-if="enableFormat && (language === 'json' || language === 'javascript')"
              :content="t('common.format')"
              placement="bottom"
              :show-after="300"
            >
              <button
                type="button"
                class="dyn-code-max__icon-btn"
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
                class="dyn-code-max__icon-btn"
                :aria-label="t('common.exitMaximize')"
                @click="closeMaximize"
              >
                <el-icon :size="16"><Close /></el-icon>
              </button>
            </el-tooltip>
          </div>
        </div>
        <div class="dyn-code-max__body">
          <CodeBlockField
            ref="maxEditorRef"
            :model-value="modelValue"
            :language="language"
            :show-toolbar="false"
            :enable-format="enableFormat"
            :global-names="globalNames"
      :branch-names="branchNames"
            maximized
            height="100%"
            @update:model-value="onUpdate"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.dyn-code {
  margin-bottom: 18px;
}
.dyn-code__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.dyn-code__label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 22px;
}
.dyn-code__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.dyn-code__icon-btn {
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
.dyn-code__icon-btn:hover:not(:disabled) {
  color: #2563eb;
  background: #f1f5f9;
}
.dyn-code__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dyn-code__below {
  margin: 0 0 8px;
}
.dyn-code__hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.5;
}
</style>

<style>
.dyn-code-max {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  flex-direction: column;
  background: #0f172a;
}
.dyn-code-max__bar {
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  color: #e2e8f0;
}
.dyn-code-max__title {
  font-size: 14px;
  font-weight: 600;
}
.dyn-code-max__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dyn-code-max__icon-btn {
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
.dyn-code-max__icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.dyn-code-max__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dyn-code-max__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.dyn-code-max__body .fg-code-block {
  flex: 1;
  height: 100%;
}
</style>
