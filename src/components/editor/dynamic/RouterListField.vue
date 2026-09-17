<script setup lang="ts">
/**
 * HTTP 路由列表结构化编辑：方法下拉 | 名称 | 路径 | 调试值 | 删除。
 * 供 DynamicConfigForm（widget=router-list）与 HttpEndpointForm 复用。
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Setting } from '@element-plus/icons-vue'
import HttpRouterDebugDialog from '../HttpRouterDebugDialog.vue'
import {
  HTTP_ROUTER_METHODS,
  createDefaultRouterItem,
  findDuplicateRouterKey,
  nextUniqueRouterPath,
  normalizeMethod,
  normalizePath,
  normalizeRouterList,
  parseRouterList,
  routerLabel,
  routerRelation,
  type HttpRouterItem,
} from '@/canvas/httpRouter'

const props = defineProps<{
  /** 路由数组，或历史遗留的 JSON 字符串 */
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [v: HttpRouterItem[]]
  change: []
}>()

const { t } = useI18n()

const rows = ref<HttpRouterItem[]>([createDefaultRouterItem()])

const debugOpen = ref(false)
const debugIndex = ref(0)
const debugTitle = ref('')
const debugSeed = ref('{}')

watch(
  () => props.modelValue,
  (v) => {
    rows.value = parseRouterList(v)
  },
  { immediate: true, deep: true },
)

function emitUp() {
  const next = normalizeRouterList(rows.value)
  rows.value = next
  emit('update:modelValue', next)
  emit('change')
}

/** 方法/路径变更：规范化并校验同 method 下 path 唯一 */
function onRouterKeyChange(i: number) {
  const r = rows.value[i]
  if (!r) return
  r.method = normalizeMethod(r.method)
  r.path = normalizePath(r.path)
  const dup = findDuplicateRouterKey(rows.value, i)
  if (dup) {
    ElMessage.warning(t('forms.httpEndpoint.duplicatePath', { path: dup }))
    const prev = parseRouterList(props.modelValue)
    const src = prev[i]
    if (src) {
      r.method = normalizeMethod(src.method)
      r.path = normalizePath(src.path)
    } else {
      r.path = '/api/demo'
    }
    return
  }
  emitUp()
}

function addRouter() {
  const path = nextUniqueRouterPath(rows.value, 'POST')
  rows.value.push({
    name: '',
    method: 'POST',
    path,
    debugValue: '{}',
  })
  emitUp()
}

function removeRouter(i: number) {
  rows.value.splice(i, 1)
  if (!rows.value.length) {
    rows.value.push(createDefaultRouterItem())
  }
  emitUp()
}

function openDebug(i: number) {
  const r = rows.value[i]
  if (!r) return
  debugIndex.value = i
  debugTitle.value = routerLabel(r) || routerRelation(r)
  debugSeed.value = r.debugValue || '{}'
  debugOpen.value = true
}

function onDebugConfirm(jsonText: string) {
  const r = rows.value[debugIndex.value]
  if (!r) return
  r.debugValue = jsonText
  emitUp()
}
</script>

<template>
  <div class="router-list-field">
    <div v-for="(r, i) in rows" :key="i" class="router-row">
      <el-select
        v-model="r.method"
        class="cell-method"
        @change="onRouterKeyChange(i)"
      >
        <el-option
          v-for="m in HTTP_ROUTER_METHODS"
          :key="m"
          :label="m"
          :value="m"
        />
      </el-select>
      <el-input
        v-model="r.name"
        class="cell-name"
        :placeholder="t('forms.httpEndpoint.namePlaceholder')"
        clearable
        @change="emitUp"
      />
      <el-input
        v-model="r.path"
        class="cell-path"
        placeholder="/api/{id}"
        @change="onRouterKeyChange(i)"
      />
      <div class="cell-actions">
        <el-button
          :icon="Setting"
          text
          :title="t('forms.httpEndpoint.debugValue')"
          @click="openDebug(i)"
        />
        <el-button
          :icon="Delete"
          text
          type="danger"
          :title="t('common.delete')"
          @click="removeRouter(i)"
        />
      </div>
    </div>
    <el-button :icon="Plus" text type="primary" @click="addRouter">
      {{ t('forms.httpEndpoint.addPath') }}
    </el-button>

    <HttpRouterDebugDialog
      v-model="debugOpen"
      :title="debugTitle"
      :value="debugSeed"
      @confirm="onDebugConfirm"
    />
  </div>
</template>

<style scoped>
.router-list-field {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.router-row {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  min-width: 0;
}
.cell-method {
  width: 92px;
  flex: 0 0 92px;
}
.cell-name {
  flex: 0 1 88px;
  min-width: 64px;
  width: 88px;
}
.cell-path {
  flex: 1 1 auto;
  min-width: 0;
}
.cell-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  margin-left: auto;
}
.cell-actions :deep(.el-button) {
  margin: 0;
  padding: 4px;
}
</style>
