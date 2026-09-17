/**
 * 认证相关 API。
 */
import http from './http'

export interface LoginResult {
  token: string
  user: {
    id: string
    username: string
    role: string
    flowIds: string[]
  }
}

export async function loginApi(username: string, password: string) {
  const { data } = await http.post<LoginResult>('/auth/login', { username, password })
  return data
}

export async function fetchMe() {
  const { data } = await http.get('/auth/me')
  return data
}

export async function changePasswordApi(oldPassword: string, newPassword: string) {
  const { data } = await http.post('/auth/password', { oldPassword, newPassword })
  return data
}
