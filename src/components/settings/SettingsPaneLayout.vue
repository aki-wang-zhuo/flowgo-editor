<script setup lang="ts">
/**
 * 设置页右侧通用布局：标题区（固定）+ 内容区（可滚动）+ 可选底栏。
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="pane">
    <header class="pane__header">
      <div class="pane__title-row">
        <h3 class="pane__title">{{ title }}</h3>
        <div v-if="$slots.actions" class="pane__actions">
          <slot name="actions" />
        </div>
      </div>
      <p v-if="description" class="pane__desc">{{ description }}</p>
    </header>
    <div class="pane__content">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="pane__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.pane__header {
  flex-shrink: 0;
  padding: 0.7rem 0.9rem 0.55rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}
.pane__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.pane__title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: #1f2937;
}
.pane__desc {
  margin: 0.25rem 0 0;
  font-size: 0.72rem;
  color: #94a3b8;
  line-height: 1.35;
}
.pane__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}
.pane__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.55rem 0.9rem 0.35rem;
  background: #fff;
}
.pane__footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 0.9rem;
  border-top: 1px solid #e5e7eb;
  background: #fafafa;
}
</style>
