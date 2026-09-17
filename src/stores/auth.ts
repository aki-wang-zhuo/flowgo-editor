/**
 * 认证状态：JWT 与当前用户信息（持久化到 localStorage）。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, type LoginResult } from '@/api/auth'

const TOKEN_KEY = 'flowgo_token'
const USER_KEY = 'flowgo_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<LoginResult['user'] | null>(
    (() => {
      const raw = localStorage.getItem(USER_KEY)
      if (!raw) return null
      try {
        return JSON.parse(raw) as LoginResult['user']
      } catch {
        return null
      }
    })(),
  )

  const isLoggedIn = computed(() => !!token.value)

  async function login(username: string, password: string) {
    const res = await loginApi(username, password)
    token.value = res.token
    user.value = res.user
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isLoggedIn, login, logout }
})
