<script setup lang="ts">
/**
 * 根组件：注入 Element Plus 语言包，并挂载路由视图。
 */
import { ElConfigProvider } from 'element-plus'
import { elementPlusLocale } from '@/i18n'
</script>

<template>
  <ElConfigProvider :locale="elementPlusLocale">
    <router-view />
  </ElConfigProvider>
</template>
