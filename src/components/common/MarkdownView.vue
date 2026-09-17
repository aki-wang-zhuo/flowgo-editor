<script setup lang="ts">
/**
 * Markdown 只读渲染（节点编辑器文档等）。
 * 解析：marked（GFM）；外观：github-markdown-css 浅色主题。
 */
import { computed } from 'vue'
import { marked } from 'marked'
import 'github-markdown-css/github-markdown-light.css'

const props = withDefaults(
  defineProps<{
    /** Markdown 原文 */
    source?: string
    /** 空内容时的占位文案 */
    emptyText?: string
  }>(),
  {
    source: '',
    emptyText: '',
  },
)

marked.setOptions({
  gfm: true,
  // 窄面板文档：段落更干净，不把每个换行都变成 <br>
  breaks: false,
})

/** 极简消毒：去掉 script / on* 事件 */
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
}

const html = computed(() => {
  const raw = (props.source || '').trim()
  if (!raw) return ''
  try {
    const out = marked.parse(raw, { async: false })
    return sanitize(typeof out === 'string' ? out : String(out))
  } catch {
    return sanitize(`<pre>${escapeHtml(raw)}</pre>`)
  }
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
</script>

<template>
  <!-- markdown-body：github-markdown-css 主题钩子 -->
  <div v-if="html" class="fg-md markdown-body" v-html="html" />
  <p v-else-if="emptyText" class="fg-md__empty">{{ emptyText }}</p>
</template>

<style scoped>
/*
 * 在 GitHub 主题之上做窄面板适配：略缩小字号、去掉默认大 padding/背景。
 */
.fg-md.markdown-body {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #24292f;
  background: transparent;
}
.fg-md.markdown-body :deep(> :first-child) {
  margin-top: 0 !important;
}
.fg-md.markdown-body :deep(> :last-child) {
  margin-bottom: 0 !important;
}
.fg-md.markdown-body :deep(h1) {
  font-size: 1.25em;
  padding-bottom: 0.25em;
}
.fg-md.markdown-body :deep(h2) {
  font-size: 1.12em;
  padding-bottom: 0.2em;
  margin-top: 1.35em;
}
.fg-md.markdown-body :deep(h3) {
  font-size: 1.02em;
  margin-top: 1.2em;
}
.fg-md.markdown-body :deep(table) {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
  font-size: 12px;
}
.fg-md.markdown-body :deep(pre) {
  font-size: 12px;
}
.fg-md__empty {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}
</style>
