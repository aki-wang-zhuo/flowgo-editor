<script setup lang="ts">
/**
 * 新建流程对话框：名称 + 可选分组（空为未分组）。
 */
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { listFlowGroups, isTrashGroup, type FlowGroup } from '@/api/group'
import { t as tGlobal } from '@/i18n'

const { t } = useI18n()

const visible = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  confirm: [payload: { name: string; groupId: string }]
}>()

const groups = ref<FlowGroup[]>([])
const loading = ref(false)
const form = reactive({
  name: tGlobal('common.unnamedFlow'),
  groupId: '',
})

const groupOptions = computed(() => [
  { id: '', name: t('common.ungrouped') },
  ...groups.value
    .filter((g) => !isTrashGroup(g))
    .map((g) => ({ id: g.id, name: g.name })),
])

async function loadGroups() {
  loading.value = true
  try {
    groups.value = await listFlowGroups()
  } catch {
    groups.value = []
  } finally {
    loading.value = false
  }
}

watch(visible, (v) => {
  if (!v) return
  form.name = tGlobal('common.unnamedFlow')
  form.groupId = ''
  void loadGroups()
})

function onCancel() {
  visible.value = false
}

function onOk() {
  const name = form.name.trim() || tGlobal('common.unnamedFlow')
  emit('confirm', { name, groupId: form.groupId })
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('createFlow.title')"
    width="400px"
    append-to-body
    @closed="onCancel"
  >
    <el-form label-position="top" @submit.prevent="onOk">
      <el-form-item :label="t('createFlow.name')">
        <el-input v-model="form.name" maxlength="64" clearable autofocus />
      </el-form-item>
      <el-form-item :label="t('createFlow.group')">
        <el-select
          v-model="form.groupId"
          :placeholder="t('createFlow.groupPlaceholder')"
          style="width: 100%"
          :loading="loading"
        >
          <el-option
            v-for="opt in groupOptions"
            :key="opt.id || '__ungrouped__'"
            :label="opt.name"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="onCancel">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="onOk">{{ t('common.create') }}</el-button>
    </template>
  </el-dialog>
</template>
