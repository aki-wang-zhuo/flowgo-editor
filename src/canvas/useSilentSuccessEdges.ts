/**
 * 静默 Success 出边：1 条出边、properties.relation=Success，画布文案为空。
 */
import type { LfInstance } from './lf-types'
import { isSilentSuccessSource } from './nodes/singleIOStyle'

const REL_SUCCESS = 'Success'

/**
 * 绑定 silent Success 节点的 edge:add：写入 relation，清空标签。
 */
export function bindSilentSuccessEdgeRules(lf: LfInstance): () => void {
  if (!lf) return () => undefined

  const onAdd = ({ data }: { data: Record<string, unknown> }) => {
    const edgeId = String(data.id || '')
    const sourceNodeId = String(data.sourceNodeId || '')
    if (!edgeId || !sourceNodeId) return
    const source = lf.getNodeModelById?.(sourceNodeId) as
      | { type?: string }
      | undefined
    if (!isSilentSuccessSource(source?.type)) return

    const edge = lf.getEdgeModelById?.(edgeId)
    lf.setProperties?.(edgeId, {
      ...(edge?.properties || {}),
      relation: REL_SUCCESS,
    })
    lf.updateText?.(edgeId, '')
  }

  lf.on?.('edge:add', onAdd)
  return () => {
    lf.off?.('edge:add', onAdd)
  }
}
