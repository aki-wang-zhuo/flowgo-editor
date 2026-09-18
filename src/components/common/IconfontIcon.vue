<script setup lang="ts">
/**
 * iconfont 字体图标：渲染 &lt;i class="iconfont icon-xxx"&gt;。
 */
defineProps<{
  /** font_class，不含 icon- 前缀，如 baocun */
  name: string
}>()
</script>

<template>
  <i class="iconfont" :class="'icon-' + name" aria-hidden="true" />
</template>
