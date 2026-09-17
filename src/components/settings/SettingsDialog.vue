<script setup lang="ts">
/**
 * 设置对话框：左侧标签导航，右侧内容区。
 * 已实现：MCP 管理、节点管理、常规（语言）；外观占位。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Box, Connection, Setting } from '@element-plus/icons-vue'
import McpSettingsPanel from './McpSettingsPanel.vue'
import NodeManagePanel from './NodeManagePanel.vue'
import GeneralSettingsPanel from './GeneralSettingsPanel.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  /** 节点开关变更后，通知工作区刷新左侧面板 */
  componentsChanged: []
  /** MCP 设置保存后，通知工作区同步 WebSocket */
  mcpChanged: [payload: { enabled: boolean }]
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

type TabId = 'mcp' | 'nodes' | 'general' | 'appearance'

const activeTab = ref<TabId>('nodes')

const tabs = computed(() => [
  { id: 'nodes' as TabId, label: t('settings.tab.nodes'), enabled: true },
  { id: 'mcp' as TabId, label: t('settings.tab.mcp'), enabled: true },
  { id: 'general' as TabId, label: t('settings.tab.general'), enabled: true },
  { id: 'appearance' as TabId, label: t('settings.tab.appearance'), enabled: false },
])

watch(visible, (v) => {
  if (v) activeTab.value = 'nodes'
})

function onMcpSaved(payload: { enabled: boolean }) {
  emit('mcpChanged', payload)
  visible.value = false
}

/** 节点变更：刷新工作区面板，保持设置对话框打开 */
function onNodesSaved() {
  emit('componentsChanged')
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('settings.title')"
    width="50vw"
    top="8vh"
    class="settings-dialog"
    append-to-body
    destroy-on-close
  >
    <div class="settings">
      <nav class="settings__nav" :aria-label="t('settings.navAria')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="settings__tab"
          :class="{ 'is-active': activeTab === tab.id, 'is-disabled': !tab.enabled }"
          :disabled="!tab.enabled"
          @click="activeTab = tab.id"
        >
          <el-icon v-if="tab.id === 'mcp'" :size="14"><Connection /></el-icon>
          <el-icon v-else-if="tab.id === 'nodes'" :size="14"><Box /></el-icon>
          <el-icon v-else-if="tab.id === 'general'" :size="14"><Setting /></el-icon>
          <span>{{ tab.label }}</span>
          <span v-if="!tab.enabled" class="settings__soon">{{ t('settings.comingSoon') }}</span>
        </button>
      </nav>
      <section class="settings__body">
        <McpSettingsPanel v-if="activeTab === 'mcp'" @saved="onMcpSaved" />
        <NodeManagePanel v-else-if="activeTab === 'nodes'" @saved="onNodesSaved" />
        <GeneralSettingsPanel v-else-if="activeTab === 'general'" />
      </section>
    </div>
  </el-dialog>
</template>

<style scoped>
.settings {
  display: flex;
  height: 75vh;
  margin: -0.5rem -0.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
.settings__nav {
  width: 168px;
  flex-shrink: 0;
  background: #f8fafc;
  border-right: 1px solid #e5e7eb;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow-x: hidden;
  overflow-y: auto;
}
.settings__tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  flex-shrink: 0;
  border: none;
  background: transparent;
  text-align: left;
  padding: 0.55rem 0.65rem;
  border-radius: 6px;
  cursor: pointer;
  color: #374151;
  font-size: 0.9rem;
}
.settings__tab:hover:not(.is-disabled) {
  background: #eef2ff;
}
.settings__tab.is-active {
  background: #e0e7ff;
  color: #3730a3;
  font-weight: 600;
}
.settings__tab.is-disabled {
  color: #9ca3af;
  cursor: not-allowed;
}
.settings__soon {
  margin-left: auto;
  font-size: 0.7rem;
  color: #a1a1aa;
}
.settings__body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 0;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.settings__body > * {
  flex: 1;
  min-height: 0;
  height: 100%;
}
</style>
