<script setup lang="ts">
/**
 * 右侧属性面板：Tab「属性 / 文档」。
 * 文档为节点类型级 Markdown，始终从服务端内存库经 API 读取。
 */
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { LfInstance } from '@/canvas/lf-types'
import { cachedComponentMeta, catalogVersion } from '@/canvas/componentCatalog'
import {
  componentDocVersion,
  loadComponentDoc,
  peekComponentDoc,
} from '@/canvas/componentDocCache'
import { syncHttpEndpointNode } from '@/canvas/useHttpEndpointEdges'
import { syncSwitchNode } from '@/canvas/useBranchEdges'
import { syncConcurrentGroupNode } from '@/canvas/useConcurrentGroupEdges'
import type { ConfigField } from '@/types/flow'
import DynamicConfigForm from './dynamic/DynamicConfigForm.vue'
import MarkdownView from '@/components/common/MarkdownView.vue'

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

/** props | doc */
const activeTab = ref('props')

const docText = ref('')
const docLoading = ref(false)
const docError = ref('')

const hasSelection = computed(() => !!props.nodeId && !!props.lf)

const configFields = computed<ConfigField[]>(() => {
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
    // 无选中时文档 Tab 禁用，强制回到属性
    if (!id) activeTab.value = 'props'
    docError.value = ''
    if (!id || !props.lf) {
      form.name = ''
      form.type = ''
      form.debug = false
      form.configuration = {}
      docText.value = ''
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
    // 同类型切换时 form.type 不变，watch(type) 不会重跑；在文档 Tab 主动回填缓存
    if (activeTab.value === 'doc' && form.type) {
      void fetchDoc(false)
    } else {
      docText.value = ''
    }
  },
  { immediate: true },
)

/** 切入文档 Tab / 换类型 / 缓存失效时加载 */
watch(
  [activeTab, () => form.type, componentDocVersion],
  ([tab, type]) => {
    if (tab !== 'doc' || !type) return
    void fetchDoc(false)
  },
)

async function fetchDoc(force: boolean) {
  const type = form.type
  if (!type) {
    docText.value = ''
    return
  }
  // 同类型优先缓存，不闪 loading
  if (!force) {
    const cached = peekComponentDoc(type)
    if (cached != null) {
      docText.value = cached
      docError.value = ''
      return
    }
  }
  docLoading.value = true
  docError.value = ''
  try {
    docText.value = await loadComponentDoc(type, force)
  } catch {
    docError.value = t('propertyPanel.docLoadFailed')
    if (force) docText.value = ''
  } finally {
    docLoading.value = false
  }
}

async function refreshDoc() {
  await fetchDoc(true)
  if (!docError.value) {
    ElMessage.success(t('propertyPanel.docRefreshed'))
  }
}

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
  if (form.type === 'concurrentGroup') {
    syncConcurrentGroupNode(props.lf, props.nodeId)
  }
  emit('change')
}
</script>

<template>
  <aside class="panel" :style="{ width: `${width}px` }">
    <!-- 无选中时仍显示 Tab；文档禁用，属性页提示选中节点 -->
    <el-tabs v-model="activeTab" class="panel__tabs">
      <el-tab-pane
        :label="
          readonly
            ? t('propertyPanel.tabPropsLocked')
            : t('propertyPanel.tabProps')
        "
        name="props"
      >
        <template v-if="hasSelection">
          <el-form label-position="top" size="small" :disabled="readonly">
            <el-form-item :label="t('propertyPanel.type')">
              <el-input :model-value="form.type" disabled />
            </el-form-item>
            <el-form-item :label="t('propertyPanel.name')">
              <el-input
                v-model="form.name"
                :disabled="readonly"
                @change="applyBasic"
              />
            </el-form-item>
            <el-form-item :label="t('propertyPanel.debug')">
              <div class="debug-row">
                <el-switch
                  v-model="form.debug"
                  :disabled="readonly"
                  @change="applyDebug"
                />
                <span class="debug-hint">{{ t('propertyPanel.debugHint') }}</span>
              </div>
            </el-form-item>

            <DynamicConfigForm
              v-if="configFields.length"
              :key="nodeId || ''"
              ref="dynFormRef"
              :fields="configFields"
              :node-type="form.type"
              :node-id="nodeId"
              :lf="lf"
              :model-value="form.configuration"
              @update:model-value="onConfigChange"
            />
            <p v-else class="no-fields">{{ t('propertyPanel.noConfigFields') }}</p>
          </el-form>
        </template>
        <p v-else class="empty">{{ t('propertyPanel.empty') }}</p>
      </el-tab-pane>

      <el-tab-pane
        :label="t('propertyPanel.tabDoc')"
        name="doc"
        :disabled="!hasSelection"
      >
        <div class="doc-toolbar">
          <el-tooltip
            :content="t('propertyPanel.docRefresh')"
            placement="top"
            :show-after="300"
          >
            <el-button
              :icon="Refresh"
              circle
              size="small"
              :loading="docLoading"
              :aria-label="t('propertyPanel.docRefresh')"
              @click="refreshDoc"
            />
          </el-tooltip>
        </div>
        <p v-if="docError" class="doc-error">{{ docError }}</p>
        <div v-loading="docLoading" class="doc-body">
          <MarkdownView
            :source="docText"
            :empty-text="t('propertyPanel.docEmpty')"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </aside>
</template>

<style scoped>
.panel {
  width: 280px;
  flex-shrink: 0;
  background: #fff;
  border-left: none;
  padding: 0.5rem 0.75rem 0.75rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.panel__tabs {
  flex: 1;
  min-height: 0;
}
.panel__tabs :deep(.el-tabs__header) {
  margin-bottom: 10px;
}
.panel__tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}
.panel__tabs :deep(.el-tabs__item) {
  font-size: 13px;
  font-weight: 600;
}
.panel__tabs :deep(.el-tabs__content) {
  overflow: visible;
}
.empty {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-top: 0.25rem;
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
.doc-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.doc-body {
  min-height: 80px;
}
.doc-error {
  margin: 0 0 8px;
  color: #c45656;
  font-size: 12px;
}
</style>
