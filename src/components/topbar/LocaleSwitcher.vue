<script setup lang="ts">
/**
 * 顶部栏语言切换：点击图标弹出中文 / English 菜单。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, currentLocale, setAppLocale, type AppLocale } from '@/i18n'

const { t } = useI18n()

/** 当前语言的短标签，用于按钮展示 */
const currentLabel = computed(
  () => SUPPORTED_LOCALES.find((l) => l.code === currentLocale.value)?.label ?? '中文',
)

function onCommand(code: string) {
  setAppLocale(code as AppLocale)
}
</script>

<template>
  <el-dropdown trigger="click" @command="onCommand">
    <button
      type="button"
      class="locale-btn"
      :title="t('userMenu.language')"
      :aria-label="t('userMenu.language')"
    >
      <span class="locale-btn__text">{{ currentLabel }}</span>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="loc in SUPPORTED_LOCALES"
          :key="loc.code"
          :command="loc.code"
          :class="{ 'is-active': loc.code === currentLocale }"
        >
          {{ loc.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.locale-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 28px;
  padding: 0 0.55rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.35);
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.locale-btn:hover {
  border-color: rgba(148, 163, 184, 0.7);
  background: rgba(30, 41, 59, 0.8);
}
.locale-btn__text {
  max-width: 4.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.el-dropdown-menu__item.is-active) {
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>
