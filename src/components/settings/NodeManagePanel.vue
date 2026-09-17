<script setup lang="ts">
/**
 * 节点管理：本地搜索、按分组折叠（默认全收起）；标题区放插件/市场入口。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Download, Search, Upload } from '@element-plus/icons-vue'
import {
  getComponentManage,
  loadComponentPlugin,
  saveComponentManage,
  setPluginEnabled,
  uninstallPlugin,
  type ComponentManageGroup,
  type ComponentManageItem,
} from '@/api/settings'
import { currentLocale } from '@/i18n'
import SettingsPaneLayout from './SettingsPaneLayout.vue'

const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const groups = ref<ComponentManageGroup[]>([])
/** 默认全部折叠 */
const activeNames = ref<string[]>([])
const keyword = ref('')

function sourceLabelText(source: string): string {
  if (source === 'builtin') return t('settings.nodes.sourceBuiltin')
  if (source === 'plugin') return t('settings.nodes.sourcePlugin')
  if (source === 'marketplace') return t('settings.nodes.sourceMarketplace')
  return source
}

function matchItem(it: ComponentManageItem, q: string) {
  if (!q) return true
  const hay = `${it.label} ${it.type} ${it.description || ''} ${it.source}`.toLowerCase()
  return hay.includes(q)
}

/** 按关键字过滤后的分组（空分组在搜索时隐藏） */
const filteredGroups = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return groups.value
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => matchItem(it, q)),
    }))
    .filter((g) => (q ? g.items.length > 0 : true))
})

watch(keyword, (v) => {
  const q = v.trim()
  if (!q) {
    activeNames.value = []
    return
  }
  // 搜索时自动展开有结果的分组
  activeNames.value = filteredGroups.value.map((g) => g.id)
})

async function load() {
  loading.value = true
  try {
    groups.value = await getComponentManage()
    activeNames.value = []
    keyword.value = ''
  } catch {
    ElMessage.error(t('settings.nodes.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    // 仅提交内置节点禁用列表；插件启停走独立接口
    const disabled: string[] = []
    for (const g of groups.value) {
      for (const it of g.items) {
        if (it.pluginId) continue
        if (!it.enabled) disabled.push(it.type)
      }
    }
    await saveComponentManage(disabled)
    ElMessage.success(t('settings.nodes.saved'))
    emit('saved')
  } catch {
    ElMessage.error(t('common.saveFailed'))
  } finally {
    saving.value = false
  }
}

/** 插件开关：确认后立即调用启停 API */
async function onPluginEnabledChange(it: ComponentManageItem, next: boolean) {
  if (!it.pluginId) return
  const prev = it.enabled
  it.enabled = next
  try {
    if (!next) {
      await ElMessageBox.confirm(
        t('settings.nodes.disableConfirm'),
        t('settings.nodes.disableTitle'),
        { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') },
      )
    }
    const res = await setPluginEnabled(it.pluginId, next)
    ElMessage.success(res.message || (next ? t('settings.nodes.enabledOk') : t('settings.nodes.disabledOk')))
    await load()
    emit('saved')
  } catch {
    it.enabled = prev
    // 用户取消不提示错误
  }
}

async function onUninstall(it: ComponentManageItem) {
  if (!it.pluginId) return
  try {
    await ElMessageBox.confirm(
      t('settings.nodes.uninstallConfirm', { name: it.label }),
      t('settings.nodes.uninstallTitle'),
      { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') },
    )
    const res = await uninstallPlugin(it.pluginId)
    ElMessage.success(res.message || t('settings.nodes.uninstalledOk'))
    await load()
    emit('saved')
  } catch {
    // 取消
  }
}

async function onPickPlugin(file: File) {
  try {
    const res = await loadComponentPlugin(file)
    if (res.status === 'ok') {
      const types = (res.types || []).join(', ')
      ElMessage.success(
        types
          ? t('settings.nodes.pluginLoaded', { types })
          : res.message || t('settings.nodes.pluginLoadedSimple'),
      )
      await load()
      emit('saved')
    } else {
      ElMessage.warning(res.message || t('settings.nodes.pluginFailed'))
    }
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data
        ?.error ||
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      t('settings.nodes.pluginFailed')
    ElMessage.error(msg)
  }
  return false
}

function onMarketplace() {
  ElMessage.info(t('settings.nodes.marketSoon'))
}

/** 语言切换后重新拉取本地化节点名 */
watch(currentLocale, () => {
  void load()
})

onMounted(() => {
  void load()
})
</script>

<template>
  <SettingsPaneLayout
    v-loading="loading"
    :title="t('settings.nodes.title')"
    :description="t('settings.nodes.description')"
  >
    <template #actions>
      <el-tooltip :content="t('settings.nodes.loadPlugin')" placement="top">
        <el-upload
          :show-file-list="false"
          :before-upload="onPickPlugin"
          accept=".exe,.zip"
        >
          <button type="button" class="icon-action" :aria-label="t('settings.nodes.loadPluginAria')">
            <el-icon :size="15"><Upload /></el-icon>
          </button>
        </el-upload>
      </el-tooltip>
      <el-tooltip :content="t('settings.nodes.marketplace')" placement="top">
        <button
          type="button"
          class="icon-action"
          :aria-label="t('settings.nodes.marketplaceAria')"
          @click="onMarketplace"
        >
          <el-icon :size="15"><Download /></el-icon>
        </button>
      </el-tooltip>
    </template>

    <div class="search">
      <el-input
        v-model="keyword"
        size="small"
        clearable
        :placeholder="t('settings.nodes.searchPlaceholder')"
        :prefix-icon="Search"
      />
    </div>

    <el-collapse v-model="activeNames" class="node-collapse">
      <el-collapse-item v-for="g in filteredGroups" :key="g.id" :name="g.id">
        <template #title>
          <span class="node-collapse__title">
            {{ g.label }}
            <span class="node-collapse__count">{{ g.items.length }}</span>
          </span>
        </template>
        <div v-if="!g.items.length" class="node-empty">{{ t('settings.nodes.empty') }}</div>
        <div v-else>
          <div v-for="it in g.items" :key="it.type" class="node-row">
            <div class="node-row__text">
              <div class="node-row__title">
                {{ it.label }}
                <span class="tag">{{ sourceLabelText(it.source) }}</span>
              </div>
              <div v-if="it.description" class="node-row__desc">{{ it.description }}</div>
            </div>
            <div class="node-row__actions">
              <el-switch
                v-if="it.pluginId"
                :model-value="it.enabled"
                size="small"
                @change="(v: boolean | string | number) => onPluginEnabledChange(it, !!v)"
              />
              <el-switch v-else v-model="it.enabled" size="small" />
              <el-button
                v-if="it.pluginId"
                :icon="Delete"
                text
                type="danger"
                size="small"
                :title="t('settings.nodes.uninstall')"
                @click="onUninstall(it)"
              />
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
    <div v-if="keyword.trim() && !filteredGroups.length" class="node-empty">{{ t('settings.nodes.noMatch') }}</div>

    <template #footer>
      <el-button type="primary" size="small" :loading="saving" @click="save">{{ t('common.save') }}</el-button>
    </template>
  </SettingsPaneLayout>
</template>

<style scoped>
.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  padding: 0;
}
.icon-action:hover {
  color: #4338ca;
  border-color: #c7d2fe;
  background: #eef2ff;
}
.search {
  margin-bottom: 0.45rem;
}
.node-collapse {
  border: none;
  --el-collapse-header-height: 22px;
}
.node-collapse :deep(.el-collapse-item__header) {
  height: 32px !important;
  min-height: 22px !important;
  line-height: 22px !important;
  font-size: 0.74rem;
  color: #475569;
  background: #f1f5f9;
  padding: 0 0.3rem;
  border-radius: 4px;
  margin-bottom: 2px;
  border: none;
  box-sizing: border-box;
}
.node-collapse :deep(.el-collapse-item__header.is-active) {
  border-bottom: none;
}
.node-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}
.node-collapse :deep(.el-collapse-item__content) {
  padding: 0 0 2px;
}
.node-collapse :deep(.el-collapse-item__arrow) {
  margin: 0 2px 0 0;
  font-size: 11px;
  height: 22px;
  line-height: 22px;
}
.node-collapse__title {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  font-weight: 600;
}
.node-collapse__count {
  font-size: 0.62rem;
  font-weight: 500;
  color: #94a3b8;
  background: #e2e8f0;
  border-radius: 999px;
  padding: 0 0.28rem;
  min-width: 0.9rem;
  text-align: center;
  line-height: 1.25;
}
.node-empty {
  padding: 0.35rem 0.2rem;
  font-size: 0.72rem;
  color: #94a3b8;
}
.node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.35rem 0.2rem;
  border-bottom: 1px solid #f3f4f6;
}
.node-row__title {
  font-size: 0.8rem;
  color: #1f2937;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.node-row__desc {
  margin-top: 0.06rem;
  font-size: 0.68rem;
  color: #9ca3af;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tag {
  font-size: 0.6rem;
  font-weight: 500;
  color: #6366f1;
  background: #eef2ff;
  padding: 0 0.26rem;
  border-radius: 3px;
  line-height: 1.35;
}
.node-row__actions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
