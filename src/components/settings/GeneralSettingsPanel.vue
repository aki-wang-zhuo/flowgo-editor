<script setup lang="ts">
/**
 * 设置 · 常规：界面语言切换。
 */
import { SUPPORTED_LOCALES, currentLocale, setAppLocale, type AppLocale } from '@/i18n'
import { useI18n } from 'vue-i18n'
import SettingsPaneLayout from './SettingsPaneLayout.vue'

const { t } = useI18n()

function onLocaleChange(code: AppLocale) {
  setAppLocale(code)
}
</script>

<template>
  <SettingsPaneLayout
    :title="t('settings.tab.general')"
    :description="t('settings.languageHint')"
  >
    <el-form label-position="top" class="general-settings">
      <el-form-item :label="t('settings.language')">
        <el-radio-group
          :model-value="currentLocale"
          @update:model-value="onLocaleChange"
        >
          <el-radio
            v-for="loc in SUPPORTED_LOCALES"
            :key="loc.code"
            :value="loc.code"
          >
            {{ loc.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
  </SettingsPaneLayout>
</template>

<style scoped>
.general-settings {
  max-width: 360px;
}
</style>
