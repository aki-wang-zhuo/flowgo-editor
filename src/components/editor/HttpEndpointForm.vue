<script setup lang="ts">
/**
 * HTTP 入口节点属性：端口 / CORS / HTTPS(证书私钥) / 多条路由。
 * 每行：方法 | 名称 | 路径 | 设置(调试值) | 删除；同 method+path 不可重复。
 */
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Setting } from '@element-plus/icons-vue'
import HttpRouterDebugDialog from './HttpRouterDebugDialog.vue'
import {
  findDuplicateRouterKey,
  normalizeMethod,
  normalizePath,
  routerLabel,
  routerRelation,
} from '@/canvas/httpRouter'

export interface HttpRouterRow {
  /** 连线展示名（选填）；空则显示 METHOD + path */
  name?: string
  method: string
  path: string
  /**
   * 调试用请求体 JSON 文本；仅编辑器调试，真实 HTTP 不使用。
   */
  debugValue?: string
}

export interface HttpEndpointFormModel {
  server: string
  allowCors: boolean
  /** 启用 HTTPS（TLS）监听 */
  https: boolean
  /** 证书 PEM 文本 */
  certPem: string
  /** 私钥 PEM 文本 */
  keyPem: string
  routers: HttpRouterRow[]
}

const props = defineProps<{
  modelValue: HttpEndpointFormModel
}>()

const emit = defineEmits<{
  'update:modelValue': [v: HttpEndpointFormModel]
  change: []
}>()

const { t } = useI18n()

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

const local = reactive<HttpEndpointFormModel>({
  server: ':8088',
  allowCors: true,
  https: false,
  certPem: '',
  keyPem: '',
  routers: [{ name: '', method: 'POST', path: '/api/demo', debugValue: '{}' }],
})

const debugOpen = ref(false)
const debugIndex = ref(0)
const debugTitle = ref('')
const debugSeed = ref('{}')

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    local.server = v.server || ':8088'
    local.allowCors = !!v.allowCors
    local.https = !!v.https
    local.certPem = v.certPem || ''
    local.keyPem = v.keyPem || ''
    local.routers = (
      v.routers?.length ? v.routers : [{ method: 'POST', path: '/api/demo' }]
    ).map((r) => ({
      name: r.name || '',
      method: r.method || 'POST',
      path: r.path || '/',
      debugValue: r.debugValue || '{}',
    }))
  },
  { immediate: true, deep: true },
)

function emitUp() {
  emit('update:modelValue', {
    server: local.server,
    allowCors: local.allowCors,
    https: !!local.https,
    certPem: local.https ? (local.certPem || '').trim() : '',
    keyPem: local.https ? (local.keyPem || '').trim() : '',
    routers: local.routers.map((r) => ({
      name: (r.name || '').trim(),
      method: normalizeMethod(r.method),
      path: normalizePath(r.path),
      debugValue: (r.debugValue || '{}').trim() || '{}',
    })),
  })
  emit('change')
}

/** 关闭 HTTPS 时清空密钥字段再提交 */
function onHttpsChange() {
  if (!local.https) {
    local.certPem = ''
    local.keyPem = ''
  }
  emitUp()
}

/** 方法/路径变更：规范化并校验同 method 下 path 唯一 */
function onRouterKeyChange(i: number) {
  const r = local.routers[i]
  if (!r) return
  r.method = normalizeMethod(r.method)
  r.path = normalizePath(r.path)
  const dup = findDuplicateRouterKey(local.routers, i)
  if (dup) {
    ElMessage.warning(t('forms.httpEndpoint.duplicatePath', { path: dup }))
    const src = props.modelValue?.routers?.[i]
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
  let path = '/api/'
  let n = 1
  while (
    findDuplicateRouterKey([
      ...local.routers,
      { method: 'POST', path },
    ])
  ) {
    path = `/api/path${n}`
    n += 1
    if (n > 99) break
  }
  local.routers.push({
    name: '',
    method: 'POST',
    path,
    debugValue: '{}',
  })
  emitUp()
}

function removeRouter(i: number) {
  local.routers.splice(i, 1)
  if (!local.routers.length) {
    local.routers.push({
      name: '',
      method: 'POST',
      path: '/api/demo',
      debugValue: '{}',
    })
  }
  emitUp()
}

function openDebug(i: number) {
  const r = local.routers[i]
  if (!r) return
  debugIndex.value = i
  debugTitle.value = routerLabel(r) || routerRelation(r)
  debugSeed.value = r.debugValue || '{}'
  debugOpen.value = true
}

function onDebugConfirm(jsonText: string) {
  const r = local.routers[debugIndex.value]
  if (!r) return
  r.debugValue = jsonText
  emitUp()
}
</script>

<template>
  <div class="http-form">
    <el-form-item :label="t('forms.httpEndpoint.server')">
      <el-input v-model="local.server" placeholder=":8088" @change="emitUp" />
      <div class="hint">{{ t('forms.httpEndpoint.serverHint') }}</div>
    </el-form-item>
    <el-form-item :label="t('forms.httpEndpoint.allowCors')">
      <el-switch v-model="local.allowCors" @change="emitUp" />
    </el-form-item>
    <el-form-item :label="t('forms.httpEndpoint.https')">
      <div class="switch-with-hint">
        <el-switch v-model="local.https" @change="onHttpsChange" />
        <span class="switch-hint">{{ t('forms.httpEndpoint.httpsHint') }}</span>
      </div>
    </el-form-item>
    <template v-if="local.https">
      <el-form-item :label="t('forms.httpEndpoint.certPem')" required>
        <el-input
          v-model="local.certPem"
          type="textarea"
          :rows="5"
          class="pem-input"
          :placeholder="t('forms.httpEndpoint.certPemPlaceholder')"
          @change="emitUp"
        />
      </el-form-item>
      <el-form-item :label="t('forms.httpEndpoint.keyPem')" required>
        <el-input
          v-model="local.keyPem"
          type="textarea"
          :rows="5"
          class="pem-input"
          :placeholder="t('forms.httpEndpoint.keyPemPlaceholder')"
          @change="emitUp"
        />
      </el-form-item>
    </template>
    <el-form-item :label="t('forms.httpEndpoint.routers')">
      <div class="routers">
        <div v-for="(r, i) in local.routers" :key="i" class="router-row">
          <el-select
            v-model="r.method"
            class="cell-method"
            @change="onRouterKeyChange(i)"
          >
            <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
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
      </div>
    </el-form-item>

    <HttpRouterDebugDialog
      v-model="debugOpen"
      :title="debugTitle"
      :value="debugSeed"
      @confirm="onDebugConfirm"
    />
  </div>
</template>

<style scoped>
.hint {
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.35;
}
/** 开关与右侧说明：横向排列、垂直居中、留出间距 */
.switch-with-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}
.switch-hint {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.35;
}
.routers {
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
.pem-input :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.4;
}
</style>
