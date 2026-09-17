/**
 * 组件目录 REST API（与引擎 Registry 同源）。
 */
import http from './http'
import type { PaletteGroup } from '@/types/flow'

export interface ComponentsResponse {
  groups: PaletteGroup[]
}

/** 拉取后端组件分组目录 */
export async function listComponents() {
  const { data } = await http.get<ComponentsResponse>('/components')
  return data.groups || []
}
