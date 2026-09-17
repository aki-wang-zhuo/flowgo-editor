<script setup lang="ts">
/**
 * 右侧属性面板：通用名称 / 调试 + 按 catalog.configFields 动态配置。
 */
import { computed, reactive, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LfInstance } from '@/canvas/lf-types'
import { cachedComponentMeta, catalogVersion } from '@/canvas/componentCatalog'
import { syncHttpEndpointNode } from '@/canvas/useHttpEndpointEdges'
import { syncSwitchNode } from '@/canvas/useBranchEdges'
import type { ConfigField } from '@/types/flow'
import DynamicConfigForm from './dynamic/DynamicConfigForm.vue'

const props = defineProps<{
  lf: LfInstance | null
  nodeId: string | null
  /** 面板宽度（由工作区拖拽控制） */
  width: number
  /** 流程锁定时属性只读 */
  readonly?: boolean
}>()

const emit = defineEmits<{
  change: []
}>()

const { t } = useI18n()

const form = reactive({
  name: '',
  type: '',
  debug: false,
  configuration: {} as Record<string, unknown>,
})

const hasSelection = computed(() => !!props.nodeId && !!props.lf)

const configFields = computed<ConfigField[]>(() => {
  // 依赖 catalogVersion，语言切换重拉后刷新字段文案
  void catalogVersion.value
  if (!form.type) return []
  return cachedComponentMeta(form.type)?.configFields || []
})

const dynFormRef =
  useTemplateRef<InstanceType<typeof DynamicConfigForm>>('dynFormRef')

watch(
  () => props.nodeId,
  (id) => {
    dynFormRef.value?.closeMaximize?.()
    if (!id || !props.lf) {
      form.name = ''
      form.type = ''
      form.debug = false
      form.configuration = {}
      return
    }
    const model = props.lf.getNodeModelById(id)
    if (!model) return
    form.name = (model.properties?.name as string) || model.text?.value || ''
    form.type = model.type
    form.debug = !!model.properties?.debug
    form.configuration = {
      ...((model.properties?.configuration as Record<string, unknown>) || {}),
    }
  },
  { immediate: true },
)

function applyBasic() {
  if (props.readonly) return
  if (!props.nodeId || !props.lf) return
  const model = props.lf.getNodeModelById(props.nodeId)
  if (!model) return
  props.lf.setProperties(props.nodeId, {
    ...model.properties,
    name: form.name,
    debug: form.debug,
    configuration: form.configuration,
  })
  props.lf.updateText(props.nodeId, form.name || form.type)
  emit('change')
}

function applyDebug() {
  if (props.readonly) return
  if (!props.nodeId || !props.lf) return
  const model = props.lf.getNodeModelById(props.nodeId)
  if (!model) return
  props.lf.setProperties(props.nodeId, {
    ...model.properties,
    debug: form.debug,
  })
  emit('change')
}

function onConfigChange(v: Record<string, unknown>) {
  if (props.readonly) return
  form.configuration = v
  if (!props.nodeId || !props.lf) return
  const model = props.lf.getNodeModelById(props.nodeId)
  if (!model) return
  props.lf.setProperties(props.nodeId, {
    ...model.properties,
    name: form.name,
    debug: form.debug,
    configuration: v,
  })
  props.lf.updateText(props.nodeId, form.name || form.type)
  if (form.type === 'httpEndpoint') {
    syncHttpEndpointNode(props.lf, props.nodeId)
  }
  if (form.type === 'switch') {
    syncSwitchNode(props.lf, props.nodeId)
  }
  emit('change')
}
</script>

<template>
  <aside class="panel" :style="{ width: `${width}px` }">
    <div class="title">{{ readonly ? t('propertyPanel.titleLocked') : t('propertyPanel.title') }}</div>
    <template v-if="hasSelection">
      <el-form label-position="top" size="small" :disabled="readonly">
        <el-form-item :label="t('propertyPanel.type')">
          <el-input :model-value="form.type" disabled />
        </el-form-item>
        <el-form-item :label="t('propertyPanel.name')">
          <el-input v-model="form.name" :disabled="readonly" @change="applyBasic" />
        </el-form-item>
        <el-form-item :label="t('propertyPanel.debug')">
          <div class="debug-row">
            <el-switch v-model="form.debug" :disabled="readonly" @change="applyDebug" />
            <span class="debug-hint">{{ t('propertyPanel.debugHint') }}</span>
          </div>
        </el-form-item>

        <DynamicConfigForm
          v-if="configFields.length"
          :key="nodeId || ''"
          ref="dynFormRef"
          :fields="configFields"
          :node-type="form.type"
          :model-value="form.configuration"
          @update:model-value="onConfigChange"
        />
        <p v-else class="no-fields">{{ t('propertyPanel.noConfigFields') }}</p>
      </el-form>
    </template>
    <p v-else class="empty">{{ t('propertyPanel.empty') }}</p>
  </aside>
</template>

<style scoped>
.panel {
  width: 280px;
  flex-shrink: 0;
  background: #fff;
  border-left: none;
  padding: 0.75rem;
  overflow: auto;
}
.title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.75rem;
}
.empty {
  color: #94a3b8;
  font-size: 0.85rem;
}
.no-fields {
  margin: 0.5rem 0 0;
  color: #94a3b8;
  font-size: 0.8rem;
}
.debug-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}
.debug-hint {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.35;
}
</style>
