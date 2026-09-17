/**
 * 客户端复制流程：拉取源 DSL，换新 id/名称后保存，再可选移入目标分组。
 * 副本为未发布草稿，不继承锁定与发布历史。
 */
import { getFlow, saveFlow, setFlowGroup, type FlowRecord } from '@/api/flow'
import { newFlowId } from '@/canvas/adapter'
import type { FlowDSL } from '@/types/flow'

/**
 * 将源流程复制为新流程。
 * @param sourceId 源流程 id
 * @param copyName 新流程显示名（如「电话服务_副本」）
 * @param groupId 目标分组；空字符串表示未分组
 */
export async function duplicateFlowAsCopy(
  sourceId: string,
  copyName: string,
  groupId: string,
): Promise<FlowRecord> {
  const src = await getFlow(sourceId)
  if (!src.dsl) {
    throw new Error('source flow has no dsl')
  }
  // 深拷贝节点与边，避免改到源对象引用
  const dsl: FlowDSL = structuredClone(src.dsl)
  dsl.id = newFlowId()
  dsl.name = copyName
  // 新流程从草稿起算，不沿用源版本号
  delete dsl.version

  let saved = await saveFlow(dsl)
  const targetGroup = groupId || ''
  if (targetGroup) {
    saved = await setFlowGroup(saved.id, targetGroup)
  }
  return saved
}
