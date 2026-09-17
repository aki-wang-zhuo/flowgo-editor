/**
 * 流程分组 REST API。
 */
import http from './http'

export interface FlowGroup {
  id: string
  name: string
  sort: number
  createdAt: string
  updatedAt: string
}

export async function listFlowGroups() {
  const { data } = await http.get<FlowGroup[]>('/flow-groups')
  return data
}

export async function createFlowGroup(name: string) {
  const { data } = await http.post<FlowGroup>('/flow-groups', { name })
  return data
}

export async function renameFlowGroup(id: string, name: string) {
  const { data } = await http.put<FlowGroup>(`/flow-groups/${encodeURIComponent(id)}`, { name })
  return data
}

export async function deleteFlowGroup(id: string) {
  const { data } = await http.delete(`/flow-groups/${encodeURIComponent(id)}`)
  return data
}
