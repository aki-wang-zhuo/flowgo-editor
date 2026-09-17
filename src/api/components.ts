/**
 * 组件目录 REST API（与引擎 Registry 同源）。
 */
import http from './http'
import type { PaletteGroup } from '@/types/flow'

export interface ComponentsResponse {
  groups: PaletteGroup[]
}

export interface ComponentDocResponse {
  type: string
  doc: string
}

export interface ComponentDocsResponse {
  items: Array<{ type: string; doc: string }>
}

/** 拉取后端组件分组目录（不含编辑器 Markdown 文档） */
export async function listComponents() {
  const { data } = await http.get<ComponentsResponse>('/components')
  return data.groups || []
}

/** 单节点编辑器文档（Markdown） */
export async function getComponentDoc(type: string) {
  const { data } = await http.get<ComponentDocResponse>(
    `/components/${encodeURIComponent(type)}/doc`,
  )
  return data
}

/** 全部已启用节点的编辑器文档（用于刷新本地缓存） */
export async function listComponentDocs() {
  const { data } = await http.get<ComponentDocsResponse>('/components/docs')
  return data
}
