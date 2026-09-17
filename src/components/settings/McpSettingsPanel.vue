<script setup lang="ts">
/**
 * MCP 管理：标题处全局开关 + 能力权限列表（由后端 capabilities 驱动）。
 * 关闭全局开关后：后端拒 MCP、断 WS；本页保存后通知工作区断开/重连。
 */
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  getMcpSettings,
  saveMcpSettings,
  type McpCapability,
  type McpPermissions,
} from '@/api/settings'
import { currentLocale } from '@/i18n'
import SettingsPaneLayout from './SettingsPaneLayout.vue'

const emit = defineEmits<{
  saved: [payload: { enabled: boolean }]
}>()

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
/** MCP 全局开关 */
const enabled = ref(true)
/** 后端下发的能力目录（含工具名与说明） */
const capabilities = ref<McpCapability[]>([])

const form = reactive<McpPermissions>({
  flowCreate: true,
  flowRead: true,
  flowUpdate: true,
  flowDelete: true,
  flowExecute: true,
  flowUnlock: false,
  notifyEditor: true,
})

/**
 * 将能力项下的工具名拼成次要说明行（如 list_flows / get_flow）。
 */
function toolsHint(cap: McpCapability): string {
  if (!cap.tools?.length) return cap.description || ''
  const names = cap.tools.map((tool) => tool.name).join(' / ')
  return cap.description ? `${cap.description} (${names})` : names
}

async function load() {
  loading.value = true
  try {
    const cfg = await getMcpSettings()
    enabled.value = cfg.enabled !== false
    Object.assign(form, cfg.permissions)
    capabilities.value = Array.isArray(cfg.capabilities) ? cfg.capabilities : []
    if (!capabilities.value.length) {
      ElMessage.warning(t('settings.mcp.noCapabilities'))
    }
  } catch {
    ElMessage.error(t('settings.mcp.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const cfg = await saveMcpSettings({
      enabled: enabled.value,
      permissions: { ...form },
    })
    enabled.value = cfg.enabled !== false
    ElMessage.success(t('settings.mcp.saved'))
    emit('saved', { enabled: enabled.value })
  } catch {
    ElMessage.error(t('common.saveFailed'))
  } finally {
    saving.value = false
  }
}

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
    :title="t('settings.mcp.title')"
    :description="
      enabled ? t('settings.mcp.description') : t('settings.mcp.descriptionOff')
    "
  >
    <template #actions>
      <div class="mcp-master">
        <span class="mcp-master__label">{{ t('settings.mcp.enabled') }}</span>
        <el-switch v-model="enabled" size="small" />
      </div>
    </template>

    <div class="list" :class="{ 'is-disabled': !enabled }">
      <div v-for="cap in capabilities" :key="cap.key" class="row">
        <div class="row__text">
          <div class="row__title">{{ cap.title }}</div>
          <div class="row__desc">{{ toolsHint(cap) }}</div>
          <ul v-if="cap.tools?.length" class="row__tools">
            <li v-for="tool in cap.tools" :key="tool.name">
              <code>{{ tool.name }}</code>
              <span v-if="tool.description"> — {{ tool.description }}</span>
            </li>
          </ul>
        </div>
        <el-switch v-model="form[cap.key]" size="small" :disabled="!enabled" />
      </div>
    </div>
    <template #footer>
      <el-button type="primary" size="small" :loading="saving" @click="save">{{
        t('common.save')
      }}</el-button>
    </template>
  </SettingsPaneLayout>
</template>

<style scoped>
.mcp-master {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.mcp-master__label {
  font-size: 0.78rem;
  color: #64748b;
}
.list.is-disabled {
  opacity: 0.55;
  pointer-events: none;
}
.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.55rem 0.1rem;
  border-bottom: 1px solid #f3f4f6;
}
.row:last-child {
  border-bottom: none;
}
.row__title {
  font-size: 0.82rem;
  color: #1f2937;
  font-weight: 500;
}
.row__desc {
  margin-top: 0.08rem;
  font-size: 0.7rem;
  color: #9ca3af;
  line-height: 1.35;
}
.row__tools {
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.row__tools li {
  font-size: 0.68rem;
  color: #6b7280;
  line-height: 1.35;
}
.row__tools code {
  font-size: 0.68rem;
  color: #4338ca;
  background: #eef2ff;
  padding: 0.05rem 0.28rem;
  border-radius: 3px;
}
</style>
