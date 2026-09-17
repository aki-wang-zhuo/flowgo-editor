<script setup lang="ts">
/**
 * HTTP 入口节点属性：端口 / CORS / HTTPS(证书私钥) / 多条路由。
 * 路由行编辑委托 RouterListField（与动态表单同一套结构化控件）。
 */
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RouterListField from './dynamic/RouterListField.vue'
import {
  normalizeRouterList,
  parseRouterList,
  type HttpRouterItem,
} from '@/canvas/httpRouter'

export interface HttpEndpointFormModel {
  server: string
  allowCors: boolean
  /** 启用 HTTPS（TLS）监听 */
  https: boolean
  /** 证书 PEM 文本 */
  certPem: string
  /** 私钥 PEM 文本 */
  keyPem: string
  routers: HttpRouterItem[]
}

const props = defineProps<{
  modelValue: HttpEndpointFormModel
}>()

const emit = defineEmits<{
  'update:modelValue': [v: HttpEndpointFormModel]
  change: []
}>()

const { t } = useI18n()

const local = reactive<HttpEndpointFormModel>({
  server: ':8088',
  allowCors: true,
  https: false,
  certPem: '',
  keyPem: '',
  routers: parseRouterList([]),
})

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    local.server = v.server || ':8088'
    local.allowCors = !!v.allowCors
    local.https = !!v.https
    local.certPem = v.certPem || ''
    local.keyPem = v.keyPem || ''
    local.routers = parseRouterList(v.routers)
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
    routers: normalizeRouterList(local.routers),
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

function onRoutersUpdate(v: HttpRouterItem[]) {
  local.routers = normalizeRouterList(v)
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
      <RouterListField
        :model-value="local.routers"
        @update:model-value="onRoutersUpdate"
      />
    </el-form-item>
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
.pem-input :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.4;
}
</style>
