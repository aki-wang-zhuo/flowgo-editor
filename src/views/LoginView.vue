<script setup lang="ts">
/**
 * 登录页：账号密码登录后进入工作区。
 */
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const form = reactive({
  username: 'admin',
  password: 'admin',
})

async function onSubmit() {
  loading.value = true
  try {
    await auth.login(form.username, form.password)
    ElMessage.success(t('auth.loginSuccess'))
    const redirect = (route.query.redirect as string) || '/'
    await router.replace(redirect)
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      t('auth.loginFailed')
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-panel">
      <h1 class="brand">FlowGo</h1>
      <p class="hint">{{ t('auth.hint') }}</p>
      <el-form label-position="top" @submit.prevent="onSubmit">
        <el-form-item :label="t('auth.username')">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item :label="t('auth.password')">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="onSubmit">
          {{ t('auth.login') }}
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(1200px 600px at 10% 0%, #dbeafe 0%, transparent 55%),
    radial-gradient(900px 500px at 90% 100%, #e2e8f0 0%, transparent 50%),
    #f8fafc;
}
.login-panel {
  width: min(400px, 92vw);
  padding: 2rem 1.75rem 1.75rem;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e2e8f0;
}
.brand {
  margin: 0;
  font-family: 'Segoe UI', 'PingFang SC', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #0f172a;
}
.hint {
  margin: 0.35rem 0 1.5rem;
  color: #64748b;
  font-size: 0.95rem;
}
.submit {
  width: 100%;
  margin-top: 0.5rem;
}
</style>
