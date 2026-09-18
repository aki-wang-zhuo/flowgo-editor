/**
 * 流程 REST API。
 */
import http from './http'
import type { FlowDSL } from '@/types/flow'

export interface FlowRecord {
  id: string
  name: string
  ownerId: string
  /** 空字符串或缺失表示未分组 */
  groupId?: string
  /** 移入垃圾箱前的分组 id（恢复用） */
  previousGroupId?: string
  /** 锁定后禁止画布修改与 MCP/API 保存删除 */
  locked?: boolean
  /** 是否设置了非空锁定密码（不回传密码） */
  hasLockPassword?: boolean
  dsl?: FlowDSL
  /** 是否已有线上发布版本 */
  published?: boolean
  /** 草稿相对已发布有未发布改动 */
  unpublishedChanges?: boolean
  /** 历史中是否有可恢复的已发布快照（下线后再上线依赖此项） */
  hasPublishHistory?: boolean
  publishedAt?: string
  publishedVersion?: number
  updatedAt: string
  createdAt: string
}

export async function listFlows() {
  const { data } = await http.get<FlowRecord[]>('/flows')
  return data
}

export async function getFlow(id: string) {
  const { data } = await http.get<FlowRecord>(`/flows/${encodeURIComponent(id)}`)
  return data
}

/** 保存整份草稿 FlowDSL（不发布、不改线上入口） */
export async function saveFlow(dsl: FlowDSL) {
  const { data } = await http.put<FlowRecord>('/flows', dsl)
  return data
}

/** 将已保存草稿发布为线上版本 */
export async function publishFlow(id: string, note?: string) {
  const { data } = await http.post<FlowRecord>(
    `/flows/${encodeURIComponent(id)}/publish`,
    { note: note || '' },
  )
  return data
}

/** 下线：撤销当前发布（归档进历史），从服务器内存卸载 */
export async function goOfflineFlow(id: string) {
  const { data } = await http.post<FlowRecord>(
    `/flows/${encodeURIComponent(id)}/offline`,
    {},
  )
  return data
}

/** 上线：从历史最近一条已发布快照恢复线上版 */
export async function goOnlineFlow(id: string) {
  const { data } = await http.post<FlowRecord>(
    `/flows/${encodeURIComponent(id)}/online`,
    {},
  )
  return data
}

/** 放弃草稿，用已发布版本覆盖 */
export async function discardDraft(id: string) {
  const { data } = await http.post<FlowRecord>(
    `/flows/${encodeURIComponent(id)}/discard-draft`,
    {},
  )
  return data
}

export interface PublishHistoryItem {
  version: number
  note?: string
  publishedAt: string
}

export interface PublishHistoryResp {
  flowId: string
  published: boolean
  publishedVersion: number
  unpublishedChanges: boolean
  items: PublishHistoryItem[]
}

export async function listPublishHistory(id: string) {
  const { data } = await http.get<PublishHistoryResp>(
    `/flows/${encodeURIComponent(id)}/publish-history`,
  )
  return data
}

/** 回滚线上已发布版本；草稿不变 */
export async function rollbackPublish(id: string, version: number) {
  const { data } = await http.post<FlowRecord>(
    `/flows/${encodeURIComponent(id)}/rollback`,
    { version },
  )
  return data
}

/** 删除发布历史中的某版本；禁止删除当前线上版本 */
export async function deletePublishHistory(id: string, version: number) {
  const { data } = await http.delete<FlowRecord>(
    `/flows/${encodeURIComponent(id)}/publish-history/${version}`,
  )
  return data
}

export async function deleteFlow(id: string) {
  const { data } = await http.delete<{
    status: string
    action?: 'trashed' | 'purged'
    flow?: FlowRecord
  }>(`/flows/${encodeURIComponent(id)}`)
  return data
}

/** 从垃圾箱恢复到原分组（不上线） */
export async function restoreFlow(id: string) {
  const { data } = await http.post<FlowRecord>(
    `/flows/${encodeURIComponent(id)}/restore`,
    {},
  )
  return data
}

/** 将流程移入分组；groupId 为空表示未分组 */
export async function setFlowGroup(id: string, groupId: string) {
  const { data } = await http.put<FlowRecord>(`/flows/${encodeURIComponent(id)}/group`, {
    groupId,
  })
  return data
}

/** 设置流程锁定状态；锁定时可设 password（可空），解锁时若有密码需传入 */
export async function setFlowLocked(id: string, locked: boolean, password?: string) {
  const { data } = await http.put<FlowRecord>(`/flows/${encodeURIComponent(id)}/lock`, {
    locked,
    password: password ?? '',
  })
  return data
}

export async function executeFlow(id: string, payload: { type?: string; data?: string }) {
  const { data } = await http.post<{ data: string }>(
    `/flows/${encodeURIComponent(id)}/execute`,
    payload,
  )
  return data
}

/** 模拟 HTTP 路径调试运行的响应 */
export interface SimulateHttpRouteResult {
  data?: string
  logs?: Array<{
    ts?: number
    flowType?: string
    nodeId?: string
    nodeName?: string
    relationType?: string
    data?: string
    err?: string
    durationMs?: number
  }>
  meta?: Record<string, string>
  error?: string
}

/**
 * 使用路径调试值模拟 HTTP 请求并执行下游。
 * 可传当前画布 DSL，无需先保存。
 */
export async function simulateHttpRoute(
  id: string,
  payload: {
    dsl?: FlowDSL
    nodeId: string
    routerIndex: number
    body?: string
  },
) {
  const { data } = await http.post<SimulateHttpRouteResult>(
    `/flows/${encodeURIComponent(id)}/debug/http-route`,
    payload,
  )
  return data
}

/**
 * 注入执行：用节点 payload（或覆盖 body）作为消息体，从该节点跑后续链路。
 */
export async function simulateInject(
  id: string,
  payload: {
    dsl?: FlowDSL
    nodeId: string
    body?: string
  },
) {
  const { data } = await http.post<SimulateHttpRouteResult>(
    `/flows/${encodeURIComponent(id)}/debug/inject`,
    payload,
  )
  return data
}

/**
 * HTTP 客户端调试：用 debugValue 作为实际请求体（不走 body 模板），从该节点执行。
 * runOnly=true 时只跑本节点；false 时继续下游。
 */
export async function simulateHttpClient(
  id: string,
  payload: {
    dsl?: FlowDSL
    nodeId: string
    body?: string
    runOnly?: boolean
  },
) {
  const { data } = await http.post<SimulateHttpRouteResult>(
    `/flows/${encodeURIComponent(id)}/debug/http-client`,
    payload,
  )
  return data
}

/**
 * JS 转换调试：用 debugValue 作为脚本 msg 入参，从该节点执行。
 * runOnly=true 时只跑本节点；false 时继续下游。
 */
export async function simulateJsTransform(
  id: string,
  payload: {
    dsl?: FlowDSL
    nodeId: string
    body?: string
    runOnly?: boolean
  },
) {
  const { data } = await http.post<SimulateHttpRouteResult>(
    `/flows/${encodeURIComponent(id)}/debug/js-transform`,
    payload,
  )
  return data
}
