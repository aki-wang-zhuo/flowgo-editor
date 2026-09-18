/**
 * 流程分组 REST API。
 */
import http from './http'

export interface FlowGroup {
  id: string
  name: string
  sort: number
  /** 系统分组（如垃圾箱），不可改名 / 删除 */
  system?: boolean
  createdAt: string
  updatedAt: string
}

/** 系统垃圾箱分组固定 id（与后端 store.TrashGroupID 一致） */
export const TRASH_GROUP_ID = '__trash__'

export function isTrashGroup(g: Pick<FlowGroup, 'id' | 'system'> | string): boolean {
  if (typeof g === 'string') return g === TRASH_GROUP_ID
  return !!g.system || g.id === TRASH_GROUP_ID
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
