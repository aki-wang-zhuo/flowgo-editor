<script setup lang="ts">
/**
 * 通用代码块编辑：CodeMirror 高亮；JSON / JavaScript 支持格式化按钮。
 * 默认注入内置变量补全（msg / metadata / global / msg.__dataTime.* 等）。
 * 可通过 showToolbar=false 隐藏内置工具条，由父级调用 format()；支持 maximized 全屏。
 */
import { Codemirror } from 'vue-codemirror'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick } from '@element-plus/icons-vue'
import prettier from 'prettier/standalone'
import * as prettierPluginBabel from 'prettier/plugins/babel'
import * as prettierPluginEstree from 'prettier/plugins/estree'
import { formatJsonLoose } from '@/utils/formatJson'
import { buildCodeCompletionsExtension } from './codeCompletions'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** 语言：json / javascript 可格式化；text 纯文本 */
    language?: 'json' | 'javascript' | 'text'
    /** 编辑区高度（最大化时忽略） */
    height?: string
    placeholder?: string
    /** 是否默认深色主题 */
    dark?: boolean
    /**
     * 是否显示内置「格式化」按钮。
     * 默认：json / javascript 且 enableFormat 为真时显示；text 不显示。
     * 父级已外置格式化按钮时请设为 false。
     */
    showToolbar?: boolean
    /**
     * 是否允许格式化（含 format() 与工具条）。
     * 默认：json / javascript 为 true；Go expr 等场景请显式 false。
     */
    enableFormat?: boolean
    /** 是否启用内置 + 流程 global 自动补全；默认 true */
    enableCompletions?: boolean
    /** 本流程 globalVars 已声明的变量名（不含 global. 前缀） */
    globalNames?: string[]
    /** 是否全屏最大化 */
    maximized?: boolean
  }>(),
  {
    language: 'json',
    height: '180px',
    placeholder: '',
    dark: true,
    maximized: false,
    enableCompletions: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [v: string]
  change: []
}>()

const { t } = useI18n()

const local = ref(props.modelValue || '')
const formatError = ref('')
const formatting = ref(false)

/** 格式化是否可用（Go expr 等应关闭） */
const formatEnabled = computed(() => {
  if (props.enableFormat != null) return props.enableFormat
  return props.language === 'json' || props.language === 'javascript'
})

const showToolbarResolved = computed(() => {
  if (props.showToolbar != null) return props.showToolbar
  return formatEnabled.value
})

const editorHeight = computed(() =>
  props.maximized ? '100%' : props.height,
)

watch(
  () => props.modelValue,
  (v) => {
    if (v !== local.value) local.value = v || ''
  },
)

const extensions = computed((): Extension[] => {
  const list: Extension[] = [
    EditorView.lineWrapping,
    // 关闭 CodeMirror 内容区浏览器拼写检查（红波浪线）
    EditorView.contentAttributes.of({ spellcheck: 'false' }),
    EditorView.theme({
      '&': { height: '100%', fontSize: '12px' },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      },
    }),
  ]
  if (props.language === 'json') list.push(json())
  if (props.language === 'javascript') list.push(javascript())
  if (props.dark) list.push(oneDark)
  if (props.enableCompletions) {
    list.push(buildCodeCompletionsExtension(props.globalNames || []))
  }
  return list
})

function tryFormatJson(raw: string): string | null {
  const r = formatJsonLoose(raw)
  return r.ok ? r.text : null
}

/** 将函数体包进临时函数再格式化，避免单独语句解析失败 */
async function tryFormatJavascript(raw: string): Promise<string | null> {
  const body = raw.replace(/\r\n/g, '\n')
  const wrapped = `function __fmt__() {\n${body}\n}\n`
  try {
    const formatted = await prettier.format(wrapped, {
      parser: 'babel',
      plugins: [prettierPluginBabel, prettierPluginEstree as never],
      semi: true,
      singleQuote: true,
      tabWidth: 2,
    })
    const open = formatted.indexOf('{')
    const close = formatted.lastIndexOf('}')
    if (open < 0 || close <= open) return null
    let inner = formatted.slice(open + 1, close)
    inner = inner.replace(/^\n/, '').replace(/\n$/, '')
    const lines = inner.split('\n')
    const trimmed = lines.map((line) =>
      line.startsWith('  ') ? line.slice(2) : line,
    )
    return trimmed.join('\n').replace(/\s+$/, '') + (trimmed.length ? '\n' : '')
  } catch {
    return null
  }
}

const editorText = computed({
  get() {
    return local.value
  },
  set(v: string) {
    local.value = v
    formatError.value = ''
    emit('update:modelValue', v)
    emit('change')
  },
})

/** 格式化当前内容（可供父级按钮调用）；enableFormat=false 时直接返回 false */
async function format(): Promise<boolean> {
  if (!formatEnabled.value) return false
  if (props.language === 'json') {
    formatting.value = true
    formatError.value = ''
    try {
      const pretty = tryFormatJson(local.value)
      if (pretty == null) {
        formatError.value = t('forms.formatJsonError')
        return false
      }
      local.value = pretty
      emit('update:modelValue', pretty)
      emit('change')
      return true
    } finally {
      formatting.value = false
    }
  }
  if (props.language === 'javascript') {
    formatting.value = true
    formatError.value = ''
    try {
      const pretty = await tryFormatJavascript(local.value)
      if (pretty == null) {
        formatError.value = t('forms.formatScriptError')
        return false
      }
      local.value = pretty
      emit('update:modelValue', pretty)
      emit('change')
      return true
    } finally {
      formatting.value = false
    }
  }
  return false
}

defineExpose({
  format,
  formatting,
  formatError,
})
</script>

<template>
  <div class="fg-code-block" :class="{ 'is-maximized': maximized }">
    <div v-if="showToolbarResolved" class="fg-code-block__bar">
      <span class="fg-code-block__spacer" />
      <el-tooltip :content="t('common.format')" placement="top" :show-after="300">
        <button
          type="button"
          class="fg-code-block__fmt"
          :aria-label="t('common.format')"
          :disabled="formatting"
          @click="format"
        >
          <el-icon :size="14"><MagicStick /></el-icon>
          <span>{{ t('common.format') }}</span>
        </button>
      </el-tooltip>
    </div>
    <div class="fg-code-block__editor" :style="{ height: editorHeight }">
      <Codemirror
        v-model="editorText"
        :placeholder="placeholder"
        :style="{ height: '100%', width: '100%' }"
        :autofocus="false"
        :indent-with-tab="true"
        :tab-size="2"
        :extensions="extensions"
      />
    </div>
    <p v-if="formatError" class="fg-code-block__err">{{ formatError }}</p>
  </div>
</template>

<style scoped>
.fg-code-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}
.fg-code-block.is-maximized {
  flex: 1;
  height: 100%;
}
.fg-code-block__bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.fg-code-block__spacer {
  flex: 1;
}
.fg-code-block__fmt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}
.fg-code-block__fmt:hover:not(:disabled) {
  color: #2563eb;
  border-color: #bfdbfe;
  background: #eff6ff;
}
.fg-code-block__fmt:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.fg-code-block__editor {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  background: #1e1e1e;
  min-height: 0;
}
.fg-code-block.is-maximized .fg-code-block__editor {
  flex: 1;
  border-radius: 0;
  border: none;
}
.fg-code-block__editor :deep(.cm-editor) {
  height: 100%;
  outline: none;
}
.fg-code-block__editor :deep(.cm-focused) {
  outline: none;
}
.fg-code-block__err {
  margin: 0;
  font-size: 11px;
  color: #dc2626;
  flex-shrink: 0;
}
</style>
