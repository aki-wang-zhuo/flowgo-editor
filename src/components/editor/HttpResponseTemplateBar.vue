<script setup lang="ts">
/**
 * HTTP 响应体：内置模板 + 用户级自定义模板（服务端 settings 文档）。
 * 选中后下拉保持选中；「保存」与「另存为」分按钮，避免混淆。
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, DocumentAdd, DocumentChecked, FolderOpened } from '@element-plus/icons-vue'
import {
  addHttpResponseTemplate,
  deleteHttpResponseTemplate,
  listHttpResponseTemplates,
  updateHttpResponseTemplate,
  type HttpResponseCustomTemplate,
} from '@/api/settings'
import {
  HTTP_RESPONSE_TEMPLATE_IDS,
  getHttpResponseTemplate,
  httpResponseBodyHasContent,
} from './httpResponseTemplates'

const props = defineProps<{
  statusCode: number
  body: string
}>()

const emit = defineEmits<{
  apply: [v: { statusCode: number; body: string }]
}>()

const { t } = useI18n()

/** 当前选中的模板 id（内置或自定义）；选中后保持，不自动清空 */
const pick = ref('')
const custom = ref<HttpResponseCustomTemplate[]>([])
const manageOpen = ref(false)
const saving = ref(false)

/** 当前选中是否为自定义模板 */
const selectedCustom = computed(() =>
  custom.value.find((c) => c.id === pick.value),
)

/** 覆盖保存仅在选中自定义模板时可点 */
const canOverwriteSave = computed(() => !!selectedCustom.value)

const overwriteSaveTooltip = computed(() =>
  canOverwriteSave.value
    ? t('forms.httpResponse.templateOverwriteSave')
    : t('forms.httpResponse.templateOverwriteSaveDisabled'),
)

function apiErr(e: unknown) {
  const ax = e as { response?: { data?: { error?: string } }; message?: string }
  return ax.response?.data?.error || ax.message || t('forms.httpResponse.templateSaveFailed')
}

async function reloadCustom() {
  try {
    custom.value = await listHttpResponseTemplates()
  } catch (e) {
    ElMessage.error(apiErr(e))
  }
}

onMounted(() => {
  void reloadCustom()
})

async function confirmOverwriteBody() {
  if (!httpResponseBodyHasContent(props.body)) return true
  try {
    await ElMessageBox.confirm(
      t('forms.httpResponse.templateOverwrite'),
      t('forms.httpResponse.templateOverwriteTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.ok'),
        cancelButtonText: t('common.cancel'),
      },
    )
    return true
  } catch {
    return false
  }
}

async function onPick(id: string | null) {
  if (!id) {
    pick.value = ''
    return
  }
  const builtin = getHttpResponseTemplate(id)
  if (builtin) {
    const next = { statusCode: builtin.statusCode, body: builtin.body(t) }
    if (!(await confirmOverwriteBody())) return
    pick.value = id
    emit('apply', next)
    return
  }
  const item = custom.value.find((c) => c.id === id)
  if (!item) return
  if (!(await confirmOverwriteBody())) return
  pick.value = id
  emit('apply', { statusCode: item.statusCode, body: item.body })
}

async function onOverwriteSave() {
  if (!selectedCustom.value) return
  try {
    await ElMessageBox.confirm(
      t('forms.httpResponse.templateOverwriteSaveConfirm', {
        name: selectedCustom.value.name,
      }),
      t('forms.httpResponse.templateOverwriteSaveTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.ok'),
        cancelButtonText: t('common.cancel'),
      },
    )
  } catch {
    return
  }
  saving.value = true
  try {
    const updated = await updateHttpResponseTemplate(selectedCustom.value.id, {
      statusCode: Number(props.statusCode) || 200,
      body: props.body || '',
    })
    custom.value = custom.value.map((c) => (c.id === updated.id ? updated : c))
    ElMessage.success(t('forms.httpResponse.templateOverwriteSaved'))
  } catch (e) {
    ElMessage.error(apiErr(e))
  } finally {
    saving.value = false
  }
}

/** 另存为新自定义模板（始终可用，与覆盖保存分开） */
async function onSaveAsNew() {
  try {
    const { value } = await ElMessageBox.prompt(
      t('forms.httpResponse.templateNamePrompt'),
      t('forms.httpResponse.templateSaveTitle'),
      {
        confirmButtonText: t('common.ok'),
        cancelButtonText: t('common.cancel'),
        inputPlaceholder: t('forms.httpResponse.templateNamePlaceholder'),
        inputValidator: (v: string) => {
          const s = (v || '').trim()
          if (!s) return t('forms.httpResponse.templateNameRequired')
          if (s.length > 64) return t('forms.httpResponse.templateNameTooLong')
          return true
        },
      },
    )
    saving.value = true
    const created = await addHttpResponseTemplate({
      name: String(value).trim(),
      statusCode: Number(props.statusCode) || 200,
      body: props.body || '',
    })
    custom.value = [...custom.value, created]
    pick.value = created.id
    ElMessage.success(t('forms.httpResponse.templateSaved'))
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(apiErr(e))
  } finally {
    saving.value = false
  }
}

async function onDeleteCustom(id: string) {
  try {
    await ElMessageBox.confirm(
      t('forms.httpResponse.templateDeleteConfirm'),
      t('forms.httpResponse.templateDeleteTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
      },
    )
    custom.value = await deleteHttpResponseTemplate(id)
    if (pick.value === id) pick.value = ''
    ElMessage.success(t('forms.httpResponse.templateDeleted'))
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(apiErr(e))
  }
}
</script>

<template>
  <div class="tpl-bar">
    <el-select
      :model-value="pick"
      class="tpl-bar__select"
      size="small"
      clearable
      filterable
      :placeholder="t('forms.httpResponse.templateSelect')"
      @update:model-value="onPick"
    >
      <el-option-group :label="t('forms.httpResponse.templateGroupBuiltin')">
        <el-option
          v-for="tid in HTTP_RESPONSE_TEMPLATE_IDS"
          :key="tid"
          :label="t('forms.httpResponse.templates.' + tid)"
          :value="tid"
        />
      </el-option-group>
      <el-option-group
        v-if="custom.length"
        :label="t('forms.httpResponse.templateGroupCustom')"
      >
        <el-option
          v-for="c in custom"
          :key="c.id"
          :label="`${c.name} (${c.statusCode})`"
          :value="c.id"
        />
      </el-option-group>
    </el-select>
    <el-tooltip :content="overwriteSaveTooltip" placement="top" :show-after="300">
      <span class="tpl-bar__btn-wrap">
        <button
          type="button"
          class="tpl-bar__btn"
          :aria-label="overwriteSaveTooltip"
          :disabled="saving || !canOverwriteSave"
          @click="onOverwriteSave"
        >
          <el-icon :size="14"><DocumentChecked /></el-icon>
        </button>
      </span>
    </el-tooltip>
    <el-tooltip :content="t('forms.httpResponse.templateSave')" placement="top" :show-after="300">
      <button
        type="button"
        class="tpl-bar__btn"
        :aria-label="t('forms.httpResponse.templateSave')"
        :disabled="saving"
        @click="onSaveAsNew"
      >
        <el-icon :size="14"><DocumentAdd /></el-icon>
      </button>
    </el-tooltip>
    <el-tooltip :content="t('forms.httpResponse.templateManage')" placement="top" :show-after="300">
      <button
        type="button"
        class="tpl-bar__btn"
        :aria-label="t('forms.httpResponse.templateManage')"
        :disabled="!custom.length"
        @click="manageOpen = true"
      >
        <el-icon :size="14"><FolderOpened /></el-icon>
      </button>
    </el-tooltip>

    <el-dialog
      v-model="manageOpen"
      :title="t('forms.httpResponse.templateManage')"
      width="420px"
      append-to-body
    >
      <p v-if="!custom.length" class="tpl-bar__empty">
        {{ t('forms.httpResponse.templateManageEmpty') }}
      </p>
      <ul v-else class="tpl-bar__list">
        <li v-for="c in custom" :key="c.id" class="tpl-bar__row">
          <span class="tpl-bar__name" :title="c.name">{{ c.name }}</span>
          <span class="tpl-bar__code">{{ c.statusCode }}</span>
          <el-button
            type="danger"
            link
            :icon="Delete"
            :aria-label="t('common.delete')"
            @click="onDeleteCustom(c.id)"
          />
        </li>
      </ul>
    </el-dialog>
  </div>
</template>

<style scoped>
.tpl-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}
.tpl-bar__select {
  flex: 1;
  min-width: 0;
}
/* 禁用按钮外包一层，保证 tooltip 仍可悬停提示 */
.tpl-bar__btn-wrap {
  display: inline-flex;
}
.tpl-bar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}
.tpl-bar__btn:hover:not(:disabled) {
  color: #2563eb;
  background: #f1f5f9;
}
.tpl-bar__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpl-bar__empty {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}
.tpl-bar__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tpl-bar__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #f1f5f9;
}
.tpl-bar__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.tpl-bar__code {
  flex: 0 0 auto;
  font-size: 12px;
  color: #94a3b8;
}
</style>
