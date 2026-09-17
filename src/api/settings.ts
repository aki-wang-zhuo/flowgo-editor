/**
 * 设置相关 API：MCP 权限、节点管理。
 */
import http from './http'

/** MCP 权限开关（字段名与后端 capabilities[].key 一致） */
export interface McpPermissions {
  flowCreate: boolean
  flowRead: boolean
  flowUpdate: boolean
  flowDelete: boolean
  flowExecute: boolean
  flowUnlock: boolean
  notifyEditor: boolean
}

/** 后端返回的单个 MCP 工具说明 */
export interface McpToolInfo {
  name: string
  description: string
}

/**
 * 一项权限能力：设置页按此列表渲染开关，避免前端写死工具名。
 */
export interface McpCapability {
  key: keyof McpPermissions
  title: string
  description: string
  tools: McpToolInfo[]
}

export interface McpSettings {
  userId: string
  /** MCP 全局开关；关闭后禁用 MCP 与编辑器 WebSocket */
  enabled: boolean
  permissions: McpPermissions
  /** GET 时由后端附带；保存响应可能不含此项 */
  capabilities?: McpCapability[]
}

/** 节点管理列表项 */
export interface ComponentManageItem {
  type: string
  label: string
  category: string
  categoryLabel: string
  description?: string
  source: string
  enabled: boolean
  /** 非空表示本地插件，可停用/卸载 */
  pluginId?: string
}

/** 节点管理分组 */
export interface ComponentManageGroup {
  id: string
  label: string
  items: ComponentManageItem[]
}

export interface ComponentPrefs {
  userId: string
  disabled: string[]
}

/** GET /api/settings/mcp */
export async function getMcpSettings() {
  const { data } = await http.get<McpSettings>('/settings/mcp')
  return data
}

/** PUT /api/settings/mcp */
export async function saveMcpSettings(payload: {
  enabled: boolean
  permissions: McpPermissions
}) {
  const { data } = await http.put<McpSettings>('/settings/mcp', payload)
  return data
}

/** GET /api/settings/components */
export async function getComponentManage() {
  const { data } = await http.get<{ groups: ComponentManageGroup[] }>('/settings/components')
  return data.groups || []
}

/** PUT /api/settings/components — 仅内置节点用户偏好 */
export async function saveComponentManage(disabled: string[]) {
  const { data } = await http.put<ComponentPrefs>('/settings/components', { disabled })
  return data
}

/** 加载本地节点插件（multipart 字段 file） */
export async function loadComponentPlugin(file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<{
    status: string
    message: string
    id?: string
    types?: string[]
  }>('/components/plugins/load', form)
  return data
}

/** 停用 / 启用本地插件 */
export async function setPluginEnabled(pluginId: string, enabled: boolean) {
  const { data } = await http.put<{ status: string; message: string; enabled: boolean }>(
    `/components/plugins/${encodeURIComponent(pluginId)}/enabled`,
    { enabled },
  )
  return data
}

/** 卸载本地插件（删除文件） */
export async function uninstallPlugin(pluginId: string) {
  const { data } = await http.delete<{ status: string; message: string }>(
    `/components/plugins/${encodeURIComponent(pluginId)}`,
  )
  return data
}

/**
 * 预留：节点市场列表。
 */
export async function listMarketplaceComponents() {
  const { data } = await http.get<{
    items: unknown[]
    status: string
    message: string
  }>('/components/marketplace')
  return data
}
