/**
 * Axios HTTP 客户端：自动附加 JWT 与 Accept-Language，统一处理 401。
 */
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { currentLocale } from '@/i18n'
import router from '@/router'

const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
  // 显式 UTF-8，避免个别环境把中文按系统默认编码发出去变成 "?"
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
})

http.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  // 组件目录等接口按此头返回已本地化的 label
  config.headers['Accept-Language'] = currentLocale.value
  // FormData 须由浏览器自动带 multipart boundary
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const auth = useAuthStore()
      auth.logout()
      router.push({ name: 'login' })
    }
    return Promise.reject(err)
  },
)

export default http
