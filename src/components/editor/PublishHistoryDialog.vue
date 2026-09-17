<script setup lang="ts">
/**
 * 发布历史：查看 / 回滚线上 / 删除历史快照（不可删当前线上版本）。
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deletePublishHistory,
  listPublishHistory,
  rollbackPublish,
  type PublishHistoryItem,
} from '@/api/flow'

const props = defineProps<{
  modelValue: boolean
  flowId: string
  locked?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  rolledBack: []
}>()

const { t } = useI18n()
const loading = ref(false)
const busy = ref(false)
const items = ref<PublishHistoryItem[]>([])
const currentVersion = ref(0)

async function reload() {
  if (!props.flowId) return
  loading.value = true
  try {
    const resp = await listPublishHistory(props.flowId)
    items.value = resp.items || []
    currentVersion.value = resp.publishedVersion || 0
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.flowId] as const,
  async ([open, id]) => {
    if (!open || !id) return
    await reload()
  },
)

function close() {
  emit('update:modelValue', false)
}

function isLive(item: PublishHistoryItem) {
  return item.version === currentVersion.value
}

async function onRollback(item: PublishHistoryItem) {
  if (props.locked || isLive(item)) return
  try {
    await ElMessageBox.confirm(
      t('workspace.rollbackConfirm', { version: item.version }),
      t('workspace.rollbackTitle'),
      { type: 'warning' },
    )
  } catch {
    return
  }
  busy.value = true
  try {
    await rollbackPublish(props.flowId, item.version)
    emit('rolledBack')
    close()
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      t('workspace.rollbackFailed')
    ElMessage.error(msg)
  } finally {
    busy.value = false
  }
}

async function onDelete(item: PublishHistoryItem) {
  if (props.locked || isLive(item)) return
  try {
    await ElMessageBox.confirm(
      t('workspace.historyDeleteConfirm', { version: item.version }),
      t('workspace.historyDeleteTitle'),
      { type: 'warning' },
    )
  } catch {
    return
  }
  busy.value = true
  try {
    await deletePublishHistory(props.flowId, item.version)
    ElMessage.success(t('workspace.historyDeleted'))
    await reload()
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      t('workspace.historyDeleteFailed')
    ElMessage.error(msg)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('workspace.historyTitle')"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p v-if="loading">{{ t('common.loading') }}</p>
    <el-empty v-else-if="!items.length" :description="t('workspace.historyEmpty')" />
    <ul v-else class="hist">
      <li v-for="it in items" :key="it.version" class="hist__item">
        <div class="hist__meta">
          <strong>v{{ it.version }}</strong>
          <span v-if="isLive(it)" class="hist__cur">{{ t('workspace.historyCurrent') }}</span>
          <span class="hist__time">{{ it.publishedAt }}</span>
          <span v-if="it.note" class="hist__note">{{ it.note }}</span>
        </div>
        <div class="hist__actions">
          <el-button
            size="small"
            :disabled="locked || busy || isLive(it)"
            @click="onRollback(it)"
          >
            {{ t('workspace.rollback') }}
          </el-button>
          <el-button
            size="small"
            type="danger"
            plain
            :disabled="locked || busy || isLive(it)"
            :title="isLive(it) ? t('workspace.historyDeleteLiveHint') : undefined"
            @click="onDelete(it)"
          >
            {{ t('common.delete') }}
          </el-button>
        </div>
      </li>
    </ul>
  </el-dialog>
</template>

<style scoped>
.hist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.hist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}
.hist__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
  min-width: 0;
}
.hist__actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}
.hist__time,
.hist__note {
  color: #64748b;
  font-size: 12px;
}
.hist__cur {
  font-size: 12px;
  color: #2563eb;
}
</style>
