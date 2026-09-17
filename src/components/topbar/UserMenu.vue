<script setup lang="ts">
/**
 * 顶部栏用户菜单：展示登录信息，提供修改密码 / 退出。
 * 语言切换已移至 LocaleSwitcher（设置按钮旁）。
 */
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { ArrowDown, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { changePasswordApi } from '@/api/auth'

const emit = defineEmits<{
  /** 退出前断开 WS 等清理 */
  beforeLogout: []
}>()

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const pwdVisible = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '' })

function onCommand(cmd: string) {
  if (cmd === 'password') {
    pwdVisible.value = true
    return
  }
  if (cmd === 'logout') {
    emit('beforeLogout')
    auth.logout()
    router.push({ name: 'login' })
  }
}

async function submitPassword() {
  try {
    await changePasswordApi(pwdForm.oldPassword, pwdForm.newPassword)
    ElMessage.success(t('userMenu.passwordChanged'))
    pwdVisible.value = false
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      t('userMenu.changeFailed')
    ElMessage.error(msg)
  }
}
</script>

<template>
  <el-dropdown trigger="click" @command="onCommand">
    <button type="button" class="user-trigger" :title="t('userMenu.account')">
      <el-icon :size="16"><User /></el-icon>
      <span class="user-trigger__name">{{ auth.user?.username || t('userMenu.fallbackUser') }}</span>
      <el-icon :size="12"><ArrowDown /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item disabled class="user-meta">
          <div class="user-meta__line">{{ auth.user?.username }}</div>
          <div class="user-meta__sub">
            {{ t('userMenu.role', { role: auth.user?.role || '-' }) }}
          </div>
        </el-dropdown-item>
        <el-dropdown-item divided command="password">{{ t('userMenu.changePassword') }}</el-dropdown-item>
        <el-dropdown-item command="logout">{{ t('userMenu.logout') }}</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <el-dialog v-model="pwdVisible" :title="t('userMenu.changePassword')" width="400px" append-to-body>
    <el-form label-position="top">
      <el-form-item :label="t('userMenu.oldPassword')">
        <el-input v-model="pwdForm.oldPassword" type="password" show-password />
      </el-form-item>
      <el-form-item :label="t('userMenu.newPassword')">
        <el-input v-model="pwdForm.newPassword" type="password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="pwdVisible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="submitPassword">{{ t('common.save') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 28px;
  padding: 0 0.55rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.35);
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.85rem;
}
.user-trigger:hover {
  border-color: rgba(148, 163, 184, 0.7);
  background: rgba(30, 41, 59, 0.8);
}
.user-trigger__name {
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-meta {
  cursor: default !important;
  opacity: 1 !important;
  line-height: 1.35;
}
.user-meta__line {
  font-weight: 600;
  color: #303133;
}
.user-meta__sub {
  font-size: 12px;
  color: #909399;
}
</style>
