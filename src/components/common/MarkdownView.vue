<script setup lang="ts">
/**
 * Markdown 只读渲染（节点编辑器文档等）。
 * 使用 marked；输出经基础消毒后 v-html。
 */
import { computed } from 'vue'
import { marked } from 'marked'

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
  breaks: true,
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
  <div v-if="html" class="fg-md" v-html="html" />
  <p v-else-if="emptyText" class="fg-md__empty">{{ emptyText }}</p>
</template>

<style scoped>
.fg-md {
  font-size: 13px;
  line-height: 1.55;
  color: #334155;
  word-break: break-word;
}
.fg-md :deep(h1),
.fg-md :deep(h2),
.fg-md :deep(h3) {
  margin: 0.85em 0 0.4em;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.3;
}
.fg-md :deep(h1) {
  font-size: 1.15rem;
}
.fg-md :deep(h2) {
  font-size: 1.05rem;
}
.fg-md :deep(h3) {
  font-size: 0.95rem;
}
.fg-md :deep(p),
.fg-md :deep(ul),
.fg-md :deep(ol) {
  margin: 0.4em 0;
}
.fg-md :deep(ul),
.fg-md :deep(ol) {
  padding-left: 1.25em;
}
.fg-md :deep(code) {
  padding: 0.1em 0.35em;
  font-size: 0.9em;
  background: #f1f5f9;
  border-radius: 4px;
}
.fg-md :deep(pre) {
  margin: 0.5em 0;
  padding: 8px 10px;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
}
.fg-md :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}
.fg-md :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 12px;
}
.fg-md :deep(th),
.fg-md :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 4px 8px;
  text-align: left;
}
.fg-md :deep(th) {
  background: #f8fafc;
}
.fg-md :deep(a) {
  color: #2563eb;
}
.fg-md__empty {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}
</style>
