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
  /** 锁定后禁止画布修改与 MCP/API 保存删除 */
  locked?: boolean
  /** 是否设置了非空锁定密码（不回传密码） */
  hasLockPassword?: boolean
  dsl?: FlowDSL
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

/** 保存整份 FlowDSL（后端以 dsl.id 为业务主键） */
export async function saveFlow(dsl: FlowDSL) {
  const { data } = await http.put<FlowRecord>('/flows', dsl)
  return data
}

export async function deleteFlow(id: string) {
  const { data } = await http.delete(`/flows/${encodeURIComponent(id)}`)
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
 * HTTP 客户端调试：用 debugValue 作为实际请求体（不走 body 模板），从该节点执行后续链路。
 */
export async function simulateHttpClient(
  id: string,
  payload: {
    dsl?: FlowDSL
    nodeId: string
    body?: string
  },
) {
  const { data } = await http.post<SimulateHttpRouteResult>(
    `/flows/${encodeURIComponent(id)}/debug/http-client`,
    payload,
  )
  return data
}
