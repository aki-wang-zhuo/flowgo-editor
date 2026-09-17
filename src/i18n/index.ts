/**
 * 应用国际化：vue-i18n + Element Plus locale 同步切换。
 * 词条按模块拆分，避免单文件过大。
 */
import { createI18n } from 'vue-i18n'
import type { App } from 'vue'
import { ref, computed } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import type { Language } from 'element-plus/es/locale'
import { zhCN } from './locales/zh-CN'
import { enUS } from './locales/en-US'

/** 支持的语言代码 */
export type AppLocale = 'zh-CN' | 'en-US'

const STORAGE_KEY = 'flowgo.locale'

export const SUPPORTED_LOCALES: { code: AppLocale; label: string }[] = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'English' },
]

function readStoredLocale(): AppLocale {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'zh-CN' || v === 'en-US') return v
  } catch {
    /* ignore */
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || ''
  if (nav.toLowerCase().startsWith('zh')) return 'zh-CN'
  return 'en-US'
}

export const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

/** 当前语言（响应式，供 Element Plus 等使用） */
export const currentLocale = ref<AppLocale>(i18n.global.locale.value as AppLocale)

/** Element Plus 组件库语言包 */
export const elementPlusLocale = computed<Language>(() =>
  currentLocale.value === 'en-US' ? en : zhCn,
)

/**
 * 切换界面语言，并持久化到 localStorage。
 */
export function setAppLocale(locale: AppLocale) {
  if (locale !== 'zh-CN' && locale !== 'en-US') return
  i18n.global.locale.value = locale
  currentLocale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale === 'zh-CN' ? 'zh-CN' : 'en')
  }
}

/** 在非 setup 场景（runner、工具函数）取翻译 */
export function t(key: string, params?: Record<string, unknown>): string {
  // vue-i18n 的 t 重载较多，这里统一转成字符串给业务用
  return String(i18n.global.t(key, params as never))
}

/** 注册到 Vue 应用 */
export function setupI18n(app: App) {
  app.use(i18n)
  setAppLocale(currentLocale.value)
}
